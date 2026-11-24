"""Dependency-free stdio transport for the embedded desktop Python runtime."""
import inspect
import json
import sys
from typing import get_type_hints


class StdioServer:
    def __init__(self, name):
        self.name = name
        self.tools = {}

    def tool(self):
        def register(fn):
            self.tools[fn.__name__] = fn
            return fn
        return register

    def describe(self, fn):
        params = inspect.signature(fn).parameters
        hints = get_type_hints(fn)
        return {"name": fn.__name__, "description": fn.__doc__,
                "inputSchema": {"type": "object", "additionalProperties": False,
                                "properties": {k: {"type": "boolean" if hints[k] is bool else "string"} for k in params},
                                "required": [k for k, p in params.items() if p.default is inspect.Parameter.empty]}}

    def run(self, transport):
        initialized = False
        for raw in sys.stdin.buffer:
            request_id = None
            try:
                if len(raw) > 128 * 1024:
                    raise ValueError("Request too large")
                msg = json.loads(raw)
                request_id = msg.get("id")
                if request_id is None:
                    continue
                method = msg["method"]
                params = msg.get("params", {})
                if method == "initialize":
                    versions = ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")
                    asked = params.get("protocolVersion")
                    result = {"protocolVersion": asked if asked in versions else versions[0], "capabilities": {"tools": {}},
                              "serverInfo": {"name": self.name, "version": "1.0.0"}}
                    initialized = True
                elif method == "ping":
                    result = {}
                elif not initialized:
                    raise ValueError("Initialize first")
                elif method == "tools/list":
                    result = {"tools": [self.describe(fn) for fn in self.tools.values()]}
                elif method == "tools/call":
                    fn = self.tools[params["name"]]
                    try:
                        args = inspect.signature(fn).bind(**params.get("arguments", {}))
                        hints = get_type_hints(fn)
                        if any(type(v) is not hints[k] for k, v in args.arguments.items()):
                            raise ValueError("Invalid argument type")
                        result = {"content": [{"type": "text", "text": json.dumps(fn(**args.arguments), ensure_ascii=False)}]}
                    except (ValueError, TypeError, KeyError, OSError) as err:
                        result = {"isError": True, "content": [{"type": "text", "text": str(err)}]}
                else:
                    raise ValueError("Unknown method")
                response = {"result": result}
            except (ValueError, TypeError, AttributeError, KeyError) as err:
                response = {"error": {"code": -32600, "message": str(err)}}
            print(json.dumps({"jsonrpc": "2.0", "id": request_id, **response}), flush=True)
