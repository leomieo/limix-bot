#![cfg(any(target_arch = "wasm32", test))]

use serde::Deserialize;
use serde_json::value::RawValue;
use std::borrow::Cow;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply<'a> {
    jsonrpc: &'a str,
    id: &'a RawValue,
    #[serde(borrow)]
    result: ResultBody<'a>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ResultBody<'a> {
    #[serde(borrow)]
    content: [Block<'a>; 1],
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Block<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    #[serde(borrow)]
    text: Cow<'a, str>,
}

fn text_reply(bytes: &[u8]) -> Option<(&str, Cow<'_, str>)> {
    let reply: Reply = serde_json::from_slice(bytes).ok()?;
    let [block] = reply.result.content;
    let id = reply.id.get();
    if reply.jsonrpc != "2.0"
        || block.kind != "text"
        || id.len() > 4096
        || !matches!(id.as_bytes().first()?, b'"' | b'-' | b'0'..=b'9')
    {
        return None;
    }
    Some((id, block.text))
}

fn text_bounds(text: &str, budget: usize) -> (usize, usize) {
    if text.is_ascii() {
        return (text.len(), text.len().min(budget));
    }
    let mut chars = 0;
    let mut prefix_bytes = 0;
    for character in text.chars() {
        chars += character.len_utf16();
        if chars <= budget {
            prefix_bytes += character.len_utf8();
        }
    }
    (chars, prefix_bytes)
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use std::cell::RefCell;

    #[derive(Default)]
    struct Decoder {
        frame: Vec<u8>,
        decoded: String,
        fields: [u32; 7],
    }

    thread_local! {
        static DECODER: RefCell<Decoder> = RefCell::default();
    }

    #[no_mangle]
    pub extern "C" fn reserve_frame(bytes: u32) -> *mut u8 {
        DECODER.with_borrow_mut(|decoder| {
            decoder.frame.resize(bytes as usize, 0);
            decoder.frame.as_mut_ptr()
        })
    }

    #[no_mangle]
    pub extern "C" fn inspect_reply(prefix_budget: u32) -> *const u32 {
        DECODER.with_borrow_mut(|decoder| {
            let Some((id, value)) = text_reply(&decoder.frame) else {
                return std::ptr::null();
            };
            let text = match value {
                Cow::Borrowed(text) => text,
                Cow::Owned(text) => {
                    decoder.decoded = text;
                    &decoder.decoded
                }
            };
            let (chars, prefix) = if prefix_budget == 0 {
                (0, 0)
            } else {
                text_bounds(text, prefix_budget as usize)
            };
            let maybe_structured = prefix_budget != 0
                && text
                    .trim_start_matches([' ', '\r', '\n', '\t'])
                    .starts_with(['[', '{']);
            decoder.fields = [
                id.as_ptr() as u32,
                id.len() as u32,
                text.as_ptr() as u32,
                text.len() as u32,
                chars as u32,
                prefix as u32,
                maybe_structured as u32,
            ];
            decoder.fields.as_ptr()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_exact_single_text_replies_and_decodes_escapes() {
        let (id, text) = text_reply(br#"{"result":{"content":[{"text":"a\n\u00e9","type":"text"}]},"id":"1","jsonrpc":"2.0"}"#).unwrap();
        assert_eq!(id, r#""1""#);
        assert_eq!(text, "a\né");
    }

    #[test]
    fn delegates_rich_invalid_and_ambiguous_frames_to_the_host() {
        for frame in [
            r#"{"id":1,"id":"1","jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"}]}}"#,
            r#"{"method":"notice","id":1,"jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"}]}}"#,
            r#"{"id":null,"jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"}]}}"#,
            r#"{"id":1,"jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"}],"structuredContent":{}}}"#,
            r#"{"id":1,"jsonrpc":"2.0","result":{"content":[{"text":"\uD800","type":"text"}]}}"#,
            r#"{"id":1,"jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"},{"text":"x","type":"text"}]}}"#,
            r#"{"id":1,"jsonrpc":"2.0","result":{"content":[{"text":"x","type":"text"}]}}oops"#,
        ] {
            assert!(text_reply(frame.as_bytes()).is_none(), "{frame}");
        }
    }

    #[test]
    fn keeps_javascript_utf16_lengths_and_whole_codepoints() {
        assert_eq!(text_bounds("aé🌱z", 3), (5, 3));
        assert_eq!(text_bounds("aé🌱z", 4), (5, 7));
        assert_eq!(text_bounds("abc", 10), (3, 3));
    }
}
