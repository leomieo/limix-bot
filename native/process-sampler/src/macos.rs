use super::{includes_process, Request, Sample};
use libproc::bsd_info::BSDInfo;
use libproc::file_info::{pidfdinfo, ListFDs, ProcFDType};
use libproc::net_info::{SocketFDInfo, SocketInfoKind, TcpSIState};
use libproc::proc_pid::{listpidinfo, pidinfo};
use libproc::task_info::TaskAllInfo;
use mach2::mach_time;
use std::collections::HashSet;
use std::mem::size_of_val;

const MAX_TREE: usize = 512;
const MAX_FDS: usize = 131_072;

fn children(pid: i32) -> Option<Vec<i32>> {
    let mut ids = vec![0i32; 16];
    loop {
        let bytes = i32::try_from(size_of_val(ids.as_slice())).ok()?;
        // libproc returns zero for both an empty list and some failures.
        unsafe {
            *libc::__error() = 0;
        }
        let count = unsafe { libc::proc_listchildpids(pid, ids.as_mut_ptr().cast(), bytes) };
        if count == 0 && unsafe { *libc::__error() } != 0 {
            return None;
        }
        let count = usize::try_from(count).ok()?;
        if count < ids.len() {
            ids.truncate(count);
            return Some(ids);
        }
        if ids.len() > MAX_TREE {
            return None;
        }
        ids.resize(ids.len() * 2, 0);
    }
}

fn tcp_endpoints(pid: i32, estimate: u32) -> Option<u32> {
    let mut capacity = (estimate as usize).saturating_add(16).clamp(16, MAX_FDS);
    let fds = loop {
        let fds = listpidinfo::<ListFDs>(pid, capacity).ok()?;
        if fds.len() < capacity {
            break fds;
        }
        if capacity == MAX_FDS {
            return None;
        }
        capacity = (capacity * 2).min(MAX_FDS);
    };
    let mut count = 0;
    for fd in fds
        .into_iter()
        .filter(|fd| matches!(ProcFDType::from(fd.proc_fdtype), ProcFDType::Socket))
    {
        let socket = pidfdinfo::<SocketFDInfo>(pid, fd.proc_fd).ok()?.psi;
        if matches!(SocketInfoKind::from(socket.soi_kind), SocketInfoKind::Tcp) {
            // XNU selects the pri_tcp union member when soi_kind is SOCKINFO_TCP.
            let state = unsafe { socket.soi_proto.pri_tcp.tcpsi_state };
            if matches!(TcpSIState::from(state), TcpSIState::Established) {
                count += 1;
            }
        }
    }
    Some(count)
}

fn start_micros(info: &BSDInfo) -> Option<u64> {
    info.pbi_start_tvsec
        .checked_mul(1_000_000)?
        .checked_add(info.pbi_start_tvusec)
}

pub(super) fn sample(req: Request) -> Option<Sample> {
    let root = i32::try_from(req.pid).ok()?;
    let mut queue = vec![(root, None)];
    let mut seen = HashSet::from([root]);
    let mut identities = Vec::new();
    let mut cpu_ticks = 0u64;
    let mut selected = 0;
    let mut connections = Some(0u32);
    while let Some((pid, parent)) = queue.pop() {
        let info = pidinfo::<TaskAllInfo>(pid, 0).ok()?;
        let start = start_micros(&info.pbsd)?;
        if parent.is_some_and(|(ppid, born)| ppid != info.pbsd.pbi_ppid || start < born) {
            return None;
        }
        if includes_process(&req, pid as u32, start / 1000) {
            selected += 1;
            cpu_ticks = cpu_ticks
                .checked_add(info.ptinfo.pti_total_user)?
                .checked_add(info.ptinfo.pti_total_system)?;
            connections =
                connections.and_then(|n| n.checked_add(tcp_endpoints(pid, info.pbsd.pbi_nfiles)?));
        }
        identities.push((pid, info.pbsd.pbi_ppid, start));
        for child in children(pid)? {
            if child as u32 == std::process::id() {
                continue;
            }
            if !seen.insert(child) || seen.len() > MAX_TREE {
                return None;
            }
            queue.push((child, Some((pid as u32, start))));
        }
    }
    if selected == 0 {
        return None;
    }
    for (pid, parent, start) in identities {
        let check = pidinfo::<BSDInfo>(pid, 0).ok()?;
        if start_micros(&check)? != start || (pid != root && check.pbi_ppid != parent) {
            return None;
        }
    }
    let mut timebase = mach_time::mach_timebase_info::default();
    if unsafe { mach_time::mach_timebase_info(&mut timebase) } != mach2::kern_return::KERN_SUCCESS
        || timebase.denom == 0
    {
        return None;
    }
    let cpu_ms =
        cpu_ticks as f64 * f64::from(timebase.numer) / f64::from(timebase.denom) / 1_000_000.0;
    Some(Sample {
        cpu_ms: Some(cpu_ms),
        connections,
    })
}
