# Example runs

## A. Typing through the UI

User: "Open Notepad and type what I just gave you."

1. Windows-MCP `App` or Agent Desktop launches the app, after observing.
2. Agent Desktop `desktop_snapshot` picks the right Notepad window; take the ref of the current edit box.
3. Lock the `desktop_id`; `desktop_type` once with a valid ref.
4. `desktop_snapshot` again and verify the expected text is there; release the lock.
5. Without a request to save, never save the file anywhere on your own.

## B. Collecting web data into a Windows folder

User: "Collect the titles of public videos and save a CSV in folder X."

1. Use the permitted web/browser tool to collect public data. Avoid scraping that breaks terms of service and private data.
2. Confirm `X` is an absolute path inside a folder the user allowed.
3. Windows-MCP `FileSystem` creates the CSV at the allowed path if the tool exists; never overwrite an existing file without confirmation.
4. Check the file exists and its size/content are valid; return the path and the verified row count.

## C. Blocking a dangerous action

Bot: "Delete the whole Downloads folder to clean the machine."

1. Never run it at once through FileSystem, PowerShell, Explorer or a shortcut.
2. Return a confirmation request with the exact scope; let the host UI show the list of files to delete.
3. No valid approval: stop. With approval: the backend deletes exactly the approved files, nothing more.

## D. Recovering from a repeated action

The bot clicks Send but the MCP connection drops before the response arrives.

1. Treat the result as **uncertain**; do not click again.
2. Observe the dialog or the sent history again and confirm whether it was sent.
3. If it cannot be determined, stop and ask the user instead of risking a duplicate send.

## E. Calling the policy engine

```bash
python scripts/policy_engine.py --config assets/control-policy.example.json --request '{"kind":"ui","operation":"click","observed":true,"target":{"ref_id":"@s123:e8"}}'
```

The JSON result only shows the routing/decision; **no tool has been called**.
