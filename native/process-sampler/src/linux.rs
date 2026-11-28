use super::{includes_process, Request, Sample};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{self, BufRead, BufReader};
use std::path::Path;

#[derive(Clone, Copy)]
struct Process {
    parent: u32,
    start_ticks: u64,
    cpu_ticks: u64,
}

fn parse_stat(bytes: &[u8]) -> Option<Process> {
    // Linux permits spaces, closing parentheses and non-UTF-8 bytes in stat's comm field.
    let end = bytes.iter().rposition(|b| *b == b')')?;
    let mut fields = std::str::from_utf8(&bytes[end + 1..])
        .ok()?
        .split_ascii_whitespace();
    let parent = fields.nth(1)?.parse().ok()?;
    let user: u64 = fields.nth(9)?.parse().ok()?;
    let system: u64 = fields.next()?.parse().ok()?;
    let start_ticks = fields.nth(6)?.parse().ok()?;
    Some(Process {
        parent,
        start_ticks,
        cpu_ticks: user.checked_add(system)?,
    })
}

fn stat(procfs: &Path, pid: u32) -> Option<Process> {
    parse_stat(&fs::read(procfs.join(pid.to_string()).join("stat")).ok()?)
}

fn table_connections(path: &Path, sockets: &HashSet<u64>) -> io::Result<u32> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let mut count = 0u32;
    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            return Ok(count);
        }
        let mut fields = line.split_ascii_whitespace();
        if fields.nth(3) == Some("01") {
            let inode = fields.nth(5).and_then(|s| s.parse().ok());
            if inode.is_some_and(|n| sockets.contains(&n)) {
                count += 1;
            }
        }
    }
}

fn connections(procfs: &Path, selected: &[u32]) -> Option<u32> {
    let mut namespaces = HashMap::new();
    let mut sockets = HashSet::new();
    for pid in selected {
        let dir = procfs.join(pid.to_string());
        let ns = fs::read_link(dir.join("ns/net")).ok()?;
        namespaces.entry(ns).or_insert_with(|| dir.join("net"));
        for fd in fs::read_dir(dir.join("fd")).ok()? {
            let target = fs::read_link(fd.ok()?.path()).ok()?;
            if let Some(inode) = target
                .to_str()
                .and_then(|s| s.strip_prefix("socket:["))
                .and_then(|s| s.strip_suffix(']'))
            {
                sockets.insert(inode.parse().ok()?);
            }
        }
    }
    let mut total = 0u32;
    for tables in namespaces.values() {
        let mut readable = false;
        for name in ["tcp", "tcp6"] {
            match table_connections(&tables.join(name), &sockets) {
                Ok(count) => {
                    total = total.checked_add(count)?;
                    readable = true;
                }
                Err(err) if err.kind() == io::ErrorKind::NotFound => {}
                Err(_) => return None,
            }
        }
        if !readable {
            return None;
        }
    }
    Some(total)
}

fn sample_from(procfs: &Path, req: Request, hz: u64) -> Option<Sample> {
    let root = stat(procfs, req.pid)?;
    let mut children = HashMap::<u32, Vec<(u32, Process)>>::new();
    for entry in fs::read_dir(procfs).ok()? {
        let name = entry.ok()?.file_name();
        let Some(pid) = name.to_str().and_then(|s| s.parse().ok()) else {
            continue;
        };
        if pid == req.pid || pid == std::process::id() {
            continue;
        }
        if let Some(process) = stat(procfs, pid) {
            children
                .entry(process.parent)
                .or_default()
                .push((pid, process));
        }
    }
    let boot_ms = if req.since_ms.is_some() {
        let system = fs::read_to_string(procfs.join("stat")).ok()?;
        system
            .lines()
            .find_map(|line| line.strip_prefix("btime "))?
            .parse::<u64>()
            .ok()?
            .checked_mul(1000)?
    } else {
        0
    };
    let mut tree = vec![(req.pid, root)];
    let mut selected = Vec::new();
    let mut cpu_ticks = 0u64;
    let mut index = 0;
    while let Some(&(pid, process)) = tree.get(index) {
        index += 1;
        let started = boot_ms.checked_add(process.start_ticks.checked_mul(1000)? / hz)?;
        if includes_process(&req, pid, started) {
            selected.push(pid);
            cpu_ticks = cpu_ticks.checked_add(process.cpu_ticks)?;
        }
        if let Some(kids) = children.remove(&pid) {
            tree.extend(
                kids.into_iter()
                    .filter(|(_, child)| child.start_ticks >= process.start_ticks),
            );
            if tree.len() > 512 {
                return None;
            }
        }
    }
    if selected.is_empty() {
        return None;
    }
    let connections = connections(procfs, &selected);
    for (pid, previous) in tree {
        let current = stat(procfs, pid)?;
        if current.start_ticks != previous.start_ticks
            || (pid != req.pid && current.parent != previous.parent)
        {
            return None;
        }
    }
    Some(Sample {
        cpu_ms: Some(cpu_ticks as f64 * 1000.0 / hz as f64),
        connections,
    })
}

pub(super) fn sample(req: Request) -> Option<Sample> {
    let hz = u64::try_from(unsafe { libc::sysconf(libc::_SC_CLK_TCK) }).ok()?;
    if hz == 0 {
        return None;
    }
    sample_from(Path::new("/proc"), req, hz)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_kernel_process_names_and_ignores_waited_for_child_cpu_time() {
        let row = b"71 (p \xff (a)b)) S 42 2 3 4 5 6 7 8 9 10 11 12 320 350 15 16 17 18 900 20";
        let process = parse_stat(row).unwrap();
        assert_eq!(process.parent, 42);
        assert_eq!(process.cpu_ticks, 23);
        assert_eq!(process.start_ticks, 900);
    }
}
