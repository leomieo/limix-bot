"""Execute the installer against isolated mock Docker/WSL/task backends."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HERE = Path(__file__).parent

class InstallerTests(unittest.TestCase):
    def scenario(self, failure=""):
        with tempfile.TemporaryDirectory(prefix="limix-server-fixture-") as temp:
            root = Path(temp)
            (root / "app").mkdir()
            shutil.copy2(HERE / "setup.ps1", root / "app/setup.ps1")
            (root / "node.ps1").write_text("'24'; $global:LASTEXITCODE=0", encoding="utf-8-sig")
            (root / "docker.ps1").write_text(r'''
Add-Content -LiteralPath $env:FIXTURE_CALLS -Value ('docker '+($args -join ' '))
$global:LASTEXITCODE=0
switch ($args[0]) {
 'info' { 'linux' }
 'image' { if ($env:FIXTURE_FAILURE -eq 'save') { $global:LASTEXITCODE=1 } }
 'ps' { 'fixture-container' }
 'inspect' {
   if ($args[2] -eq '{{json .Mounts}}') { '[{"Type":"volume","Name":"limix-home-11111111-1111-4111-8111-111111111111_cloud"}]' }
   else { 'true' }
 }
 'run' { if ($env:FIXTURE_FAILURE -eq 'export') { $global:LASTEXITCODE=1 } }
}
''', encoding="utf-8-sig")
            harness = r'''
$ErrorActionPreference='Stop'
Import-Module Microsoft.PowerShell.Security,Microsoft.PowerShell.Utility,Microsoft.PowerShell.Management -ErrorAction Stop
$env:LOCALAPPDATA=$env:FIXTURE_ROOT
New-Item -ItemType Directory -Path (Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host') | Out-Null
@{Token=(ConvertTo-SecureString 'fixture-token' -AsPlainText -Force);Image='limix-managed-home:beta';Capacity=2} | Export-Clixml (Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host\host.xml')
function global:Get-Command { param($Name) if($Name -eq 'node.exe') { @{Source=(Join-Path $env:FIXTURE_ROOT 'node.ps1')} } else { @{Source=(Join-Path $env:FIXTURE_ROOT 'docker.ps1')} } }
function global:Get-CimInstance { @() }
function global:New-ScheduledTaskAction { @{} }
function global:New-ScheduledTaskTrigger { [pscustomobject]@{Delay=''} }
function global:New-ScheduledTaskSettingsSet { [pscustomobject]@{Enabled=$true} }
function global:Register-ScheduledTask {
 if($env:FIXTURE_FAILURE -eq 'password') { throw 'Invalid Windows credential' }
 Add-Content $env:FIXTURE_CALLS 'task registered'
}
function global:Enable-ScheduledTask { Add-Content $env:FIXTURE_CALLS 'task enabled' }
function global:Start-ScheduledTask { Add-Content $env:FIXTURE_CALLS 'task started' }
function global:wsl.exe {
 Add-Content $env:FIXTURE_CALLS ('wsl '+($args -join ' '))
 $global:LASTEXITCODE=0
 if($args[0] -eq '--list') { 'LimixCloud' }
 if($env:FIXTURE_FAILURE -eq 'import' -and ($args -contains '-xzf')) { $global:LASTEXITCODE=1 }
 if($env:FIXTURE_FAILURE -eq 'nonempty' -and ($args -contains '-c')) { $global:LASTEXITCODE=1 }
}
& (Join-Path $env:FIXTURE_ROOT 'app\setup.ps1')
'''
            (root / "harness.ps1").write_text(harness, encoding="utf-8-sig")
            env = dict(os.environ, FIXTURE_ROOT=str(root), FIXTURE_CALLS=str(root / "calls"), FIXTURE_FAILURE=failure)
            env = {k:v for k,v in env.items() if k.upper() != 'PSMODULEPATH'}
            env['PSModulePath'] = str(Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/Modules')
            result = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(root / "harness.ps1")],
                input=json.dumps({"Password":"fixture-local-password"}), text=True, encoding="utf-8", errors="replace", capture_output=True, env=env, timeout=30)
            calls = (root / "calls").read_text(encoding="utf-8-sig") if (root / "calls").exists() else ""
            self.assertNotIn("fixture-local-password", result.stdout + result.stderr + calls)
            return result.returncode, calls, result.stdout + result.stderr

    def test_success_starts_only_after_volume_import(self):
        code, calls, output = self.scenario()
        self.assertEqual(code, 0, output)
        self.assertLess(calls.index('-xzf'), calls.index('task enabled'))
        self.assertIn('task started', calls)
        self.assertNotIn('volume rm', calls)
        self.assertNotIn('docker rm', calls)

    def test_wrong_windows_password_does_not_stop_containers(self):
        code, calls, _ = self.scenario('password')
        self.assertNotEqual(code, 0)
        self.assertNotIn('docker stop', calls)

    def test_failed_image_save_does_not_stop_containers(self):
        code, calls, _ = self.scenario('save')
        self.assertNotEqual(code, 0)
        self.assertNotIn('docker stop', calls)

    def test_failed_export_restarts_originals_without_starting_new_host(self):
        code, calls, _ = self.scenario('export')
        self.assertNotEqual(code, 0)
        self.assertIn('docker start fixture-container', calls)
        self.assertNotIn('task started', calls)

    def test_existing_destination_is_not_overwritten(self):
        code, calls, _ = self.scenario('nonempty')
        self.assertNotEqual(code, 0)
        self.assertNotIn('-xzf', calls)
        self.assertIn('docker start fixture-container', calls)

    def test_failed_import_restarts_originals(self):
        code, calls, _ = self.scenario('import')
        self.assertNotEqual(code, 0)
        self.assertIn('docker start fixture-container', calls)
        self.assertNotIn('task started', calls)

if __name__ == '__main__':
    unittest.main()
