use super::{includes_process, Request, Sample};
use std::collections::{HashMap, HashSet};
use std::mem::{offset_of, size_of};
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::time::{SystemTime, UNIX_EPOCH};
use windows_sys::Win32::{
    Foundation::{
        GetLastError, ERROR_INSUFFICIENT_BUFFER, ERROR_NO_MORE_FILES, FILETIME,
        INVALID_HANDLE_VALUE, NO_ERROR,
    },
    NetworkManagement::IpHelper::{
        GetExtendedTcpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID, MIB_TCPROW_OWNER_PID,
        MIB_TCPTABLE_OWNER_PID, MIB_TCP_STATE_ESTAB, TCP_TABLE_OWNER_PID_CONNECTIONS,
    },
    Networking::WinSock::{AF_INET, AF_INET6},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Threading::{GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    },
};

const UNIX_EPOCH_TICKS: u64 = 116_444_736_000_000_000;
const TICKS_PER_MS: u64 = 10_000;
const MAX_SNAPSHOT_PROCESSES: usize = 131_072;
const MAX_TREE_PROCESSES: usize = 4_096;

fn ticks(time: FILETIME) -> u64 {
    (u64::from(time.dwHighDateTime) << 32) | u64::from(time.dwLowDateTime)
}

struct Process {
    _handle: OwnedHandle,
    created: u64,
    cpu_ticks: u64,
}

impl Process {
    fn read(pid: u32) -> Option<Self> {
        let raw = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if raw.is_null() {
            return None;
        }
        let handle = unsafe { OwnedHandle::from_raw_handle(raw) };
        let [mut created, mut exited, mut kernel, mut user] = [FILETIME::default(); 4];
        if unsafe {
            GetProcessTimes(
                handle.as_raw_handle(),
                &mut created,
                &mut exited,
                &mut kernel,
                &mut user,
            )
        } == 0
        {
            return None;
        }
        Some(Self {
            _handle: handle,
            created: ticks(created),
            cpu_ticks: ticks(kernel).checked_add(ticks(user))?,
        })
    }
}

fn process_tree(root: u32) -> Option<HashMap<u32, Vec<u32>>> {
    let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if raw == INVALID_HANDLE_VALUE {
        return None;
    }
    let snapshot = unsafe { OwnedHandle::from_raw_handle(raw) };
    let mut row = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    if unsafe { Process32FirstW(snapshot.as_raw_handle(), &mut row) } == 0 {
        return None;
    }
    let mut children = HashMap::<u32, Vec<u32>>::new();
    let mut found = false;
    for _ in 0..MAX_SNAPSHOT_PROCESSES {
        found |= row.th32ProcessID == root;
        children
            .entry(row.th32ParentProcessID)
            .or_default()
            .push(row.th32ProcessID);
        if unsafe { Process32NextW(snapshot.as_raw_handle(), &mut row) } == 0 {
            return (unsafe { GetLastError() } == ERROR_NO_MORE_FILES && found).then_some(children);
        }
    }
    None
}

fn tcp_table(family: u16) -> Option<Vec<u32>> {
    let mut words = vec![0u32; 1024];
    // GetExtendedTcpTable can report a larger table again if connections appear between calls.
    for _ in 0..4 {
        let mut bytes = u32::try_from(words.len() * size_of::<u32>()).ok()?;
        let status = unsafe {
            GetExtendedTcpTable(
                words.as_mut_ptr().cast(),
                &mut bytes,
                0,
                u32::from(family),
                TCP_TABLE_OWNER_PID_CONNECTIONS,
                0,
            )
        };
        match status {
            NO_ERROR if bytes as usize <= words.len() * size_of::<u32>() => {
                words.truncate(bytes as usize / size_of::<u32>());
                return Some(words);
            }
            ERROR_INSUFFICIENT_BUFFER
                if (bytes as usize) > words.len() * size_of::<u32>()
                    && bytes <= 16 * 1024 * 1024 =>
            {
                words.resize((bytes as usize).div_ceil(size_of::<u32>()), 0);
            }
            _ => return None,
        }
    }
    None
}

#[derive(Clone, Copy)]
struct TcpLayout {
    first_row: usize,
    row_size: usize,
    state: usize,
    owner: usize,
}

const IPV4: TcpLayout = TcpLayout {
    first_row: offset_of!(MIB_TCPTABLE_OWNER_PID, table) / 4,
    row_size: size_of::<MIB_TCPROW_OWNER_PID>() / 4,
    state: offset_of!(MIB_TCPROW_OWNER_PID, dwState) / 4,
    owner: offset_of!(MIB_TCPROW_OWNER_PID, dwOwningPid) / 4,
};
const IPV6: TcpLayout = TcpLayout {
    first_row: offset_of!(MIB_TCP6TABLE_OWNER_PID, table) / 4,
    row_size: size_of::<MIB_TCP6ROW_OWNER_PID>() / 4,
    state: offset_of!(MIB_TCP6ROW_OWNER_PID, dwState) / 4,
    owner: offset_of!(MIB_TCP6ROW_OWNER_PID, dwOwningPid) / 4,
};

fn count_established(table: &[u32], layout: TcpLayout, pids: &HashSet<u32>) -> Option<u32> {
    let count = *table.first()? as usize;
    let words = table
        .get(layout.first_row..)?
        .get(..count.checked_mul(layout.row_size)?)?;
    let established = words
        .chunks_exact(layout.row_size)
        .filter(|row| {
            row[layout.state] == MIB_TCP_STATE_ESTAB as u32 && pids.contains(&row[layout.owner])
        })
        .count();
    u32::try_from(established).ok()
}

fn connections(pids: &HashSet<u32>) -> Option<u32> {
    let v4 = count_established(&tcp_table(AF_INET)?, IPV4, pids)?;
    let v6 = count_established(&tcp_table(AF_INET6)?, IPV6, pids)?;
    v4.checked_add(v6)
}

pub(super) fn sample(req: Request) -> Option<Sample> {
    let root = Process::read(req.pid)?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?;
    let before_snapshot =
        UNIX_EPOCH_TICKS.checked_add(u64::try_from(now.as_nanos() / 100).ok()?)?;
    let children = process_tree(req.pid)?;
    let mut stack = vec![(req.pid, root)];
    let mut visited = HashSet::from([req.pid]);
    let mut pids = HashSet::new();
    let mut cpu_ticks = 0u64;
    // Keep selected process objects alive through the TCP table read so Windows cannot reuse their IDs.
    let mut pinned = Vec::new();
    while let Some((pid, process)) = stack.pop() {
        if process.created > before_snapshot {
            return None;
        }
        let created_ms = process.created.checked_sub(UNIX_EPOCH_TICKS)? / TICKS_PER_MS;
        if includes_process(&req, pid, created_ms) {
            pids.insert(pid);
            cpu_ticks = cpu_ticks.checked_add(process.cpu_ticks)?;
        }
        if let Some(descendants) = children.get(&pid) {
            for &child in descendants {
                if child == std::process::id() || !visited.insert(child) {
                    continue;
                }
                if visited.len() > MAX_TREE_PROCESSES {
                    return None;
                }
                let candidate = Process::read(child)?;
                // A process can survive its parent, whose numeric ID may then identify a newer process.
                if candidate.created >= process.created {
                    stack.push((child, candidate));
                }
            }
        }
        pinned.push(process);
    }
    if pids.is_empty() {
        return None;
    }
    Some(Sample {
        cpu_ms: Some(cpu_ticks as f64 / TICKS_PER_MS as f64),
        connections: connections(&pids),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::START_SLACK_MS;
    use std::io::{BufRead, BufReader};
    use std::net::{TcpListener, TcpStream};
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::sync::Mutex;
    use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;

    static FIXTURE_TREE: Mutex<()> = Mutex::new(());

    #[test]
    fn applies_start_slack_once_to_descendants_only() {
        let request = Request {
            pid: 1,
            since_ms: Some(5_000),
        };
        assert!(includes_process(&request, 2, 3_000));
        assert!(!includes_process(&request, 2, 2_999));
        assert!(!includes_process(&request, 1, 5_000));
    }

    #[test]
    fn includes_only_established_endpoints_owned_by_the_tree() {
        for layout in [IPV4, IPV6] {
            let pids = HashSet::from([8]);
            let mut table = vec![0; layout.first_row + 3 * layout.row_size];
            table[0] = 3;
            for (index, (owner, state)) in [(8, 5), (8, 2), (9, 5)].into_iter().enumerate() {
                let start = layout.first_row + index * layout.row_size;
                table[start + layout.owner] = owner;
                table[start + layout.state] = state;
            }
            assert_eq!(
                count_established(&table[..table.len() - 1], layout, &pids),
                None
            );
            assert_eq!(count_established(&table, layout, &pids), Some(1));
        }
    }

    #[test]
    fn includes_a_child_at_the_start_boundary_and_excludes_its_parent() {
        let _fixture = FIXTURE_TREE.lock().unwrap();
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let _client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let _peer = listener.accept().unwrap();
        let mut child = Command::new("cmd.exe")
            .args(["/D", "/Q", "/K", "echo ready"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let mut ready = String::new();
        BufReader::new(child.stdout.as_mut().unwrap())
            .read_line(&mut ready)
            .unwrap();
        assert_eq!(ready.trim(), "ready");
        let process = Process::read(child.id()).unwrap();
        let created_ms = (process.created - UNIX_EPOCH_TICKS) / TICKS_PER_MS;
        let with_slack = |ms| {
            sample(Request {
                pid: std::process::id(),
                since_ms: Some(ms),
            })
        };
        let included = with_slack(created_ms + START_SLACK_MS);
        let descendants = with_slack(0);
        drop(child.stdin.take());
        child.wait().unwrap();
        let included = included.unwrap();
        assert!(included.cpu_ms.unwrap() >= 0.0);
        assert_eq!(included.connections, Some(0));
        assert_eq!(descendants.unwrap().connections, Some(0));
    }

    #[test]
    fn sees_an_isolated_loopback_connection_and_cpu() {
        let _fixture = FIXTURE_TREE.lock().unwrap();
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let _client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let _peer = listener.accept().unwrap();
        let got = sample(Request {
            pid: std::process::id(),
            since_ms: None,
        })
        .unwrap();
        assert!(got.cpu_ms.unwrap() >= 0.0);
        assert!(got.connections.unwrap() >= 2);
    }

    #[test]
    fn absent_root_and_no_matching_descendants_are_unknown() {
        let _fixture = FIXTURE_TREE.lock().unwrap();
        assert!(sample(Request {
            pid: u32::MAX,
            since_ms: None
        })
        .is_none());
        assert!(sample(Request {
            pid: std::process::id(),
            since_ms: Some(9_007_199_254_740_991)
        })
        .is_none());
    }
}
