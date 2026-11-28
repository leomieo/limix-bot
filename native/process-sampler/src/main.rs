#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;
#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(windows)]
use windows as platform;

use std::ffi::OsString;
use std::process::ExitCode;

#[derive(Debug, PartialEq, Eq)]
struct Request {
    pid: u32,
    since_ms: Option<u64>,
}

const START_SLACK_MS: u64 = 2_000;

fn includes_process(req: &Request, pid: u32, created_ms: u64) -> bool {
    req.since_ms
        .is_none_or(|ms| pid != req.pid && created_ms >= ms.saturating_sub(START_SLACK_MS))
}

fn decimal(value: OsString) -> Option<u64> {
    let text = value.to_str()?;
    if text.is_empty() || text.len() > 16 || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

fn request(mut args: impl Iterator<Item = OsString>) -> Option<Request> {
    let pid = u32::try_from(decimal(args.next()?)?)
        .ok()
        .filter(|p| *p != 0)?;
    let since_ms = match args.next() {
        Some(value) => Some(decimal(value).filter(|n| *n <= 9_007_199_254_740_991)?),
        None => None,
    };
    args.next().is_none().then_some(Request { pid, since_ms })
}

#[derive(Default)]
struct Sample {
    cpu_ms: Option<f64>,
    connections: Option<u32>,
}

fn show(value: Option<impl std::fmt::Display>) -> String {
    value.map_or_else(|| "null".to_owned(), |v| v.to_string())
}

fn main() -> ExitCode {
    #[cfg(target_os = "linux")]
    if std::env::args_os().skip(1).eq([OsString::from("--stdio")]) {
        use std::io::{BufRead, Read};
        let mut input = std::io::stdin().lock();
        let mut line = String::new();
        loop {
            line.clear();
            match (&mut input).take(64).read_line(&mut line) {
                Ok(0) => return ExitCode::SUCCESS,
                Ok(_) if line.ends_with('\n') => (),
                _ => return ExitCode::from(2),
            }
            let Some(req) = request(line.split_ascii_whitespace().map(OsString::from)) else {
                return ExitCode::from(2);
            };
            emit_sample(req);
        }
    }
    let Some(req) = request(std::env::args_os().skip(1)) else {
        eprintln!("Usage: limix-process-sampler <pid> [sinceMs]");
        return ExitCode::from(2);
    };
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    compile_error!("Unsupported process sampler target");
    emit_sample(req);
    ExitCode::SUCCESS
}

fn emit_sample(req: Request) {
    let sample = platform::sample(req).unwrap_or_default();
    println!(
        "{{\"cpuMs\":{},\"connections\":{}}}",
        show(sample.cpu_ms),
        show(sample.connections)
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn samples_owned_cpu_and_tcp_and_limits_a_tool_call_to_its_descendants() {
        use std::net::{TcpListener, TcpStream};
        use std::process::Command;
        use std::time::{SystemTime, UNIX_EPOCH};

        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let _client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let _accepted = listener.accept().unwrap();
        let since = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let mut leaf = Command::new("/bin/sleep").arg("30").spawn().unwrap();
        let probe = |since_ms| {
            platform::sample(Request {
                pid: std::process::id(),
                since_ms,
            })
        };
        let whole = probe(None);
        let tool = probe(Some(since));
        let future = probe(Some(since + 60_000));
        leaf.kill().unwrap();
        leaf.wait().unwrap();
        let whole = whole.unwrap();
        assert!(whole.cpu_ms.unwrap() >= 0.0);
        assert!(whole.connections.unwrap() >= 2);
        let tool = tool.unwrap();
        assert!(tool.cpu_ms.unwrap() >= 0.0);
        assert_eq!(tool.connections, Some(0));
        assert!(future.is_none());
        assert!(platform::sample(Request {
            pid: u32::MAX,
            since_ms: None
        })
        .is_none());
    }

    #[test]
    fn validates_the_entire_request() {
        let parse = |s: &str| request(s.split_ascii_whitespace().map(OsString::from));
        for s in [
            "",
            "0",
            "no",
            "4294967296",
            "-32",
            "+1",
            "1 1.5",
            "1 -1",
            "1 9007199254740992",
            "1 2 3",
        ] {
            assert_eq!(parse(s), None, "{s}");
        }
        assert_eq!(
            parse("42"),
            Some(Request {
                pid: 42,
                since_ms: None
            })
        );
        assert_eq!(
            parse("4294967295 0"),
            Some(Request {
                pid: u32::MAX,
                since_ms: Some(0)
            })
        );
    }
}
