"""Isolated Hyper-V cutover tests. These do not create real VMs or modify Docker."""
import importlib.util
import base64
import io
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent

class CutoverTests(unittest.TestCase):
    def scenario(self, failure=''):
        with tempfile.TemporaryDirectory(prefix='limix-hyperv-fixture-') as temp:
            root = Path(temp)
            app = root / 'app'; app.mkdir()
            for name in ['hyperv-setup.ps1','hyperv-common.ps1','host.mjs','power-probe.mjs','updater.mjs','docker-backend.mjs','compose.yaml','linux-bootstrap.py','linux-health.py']:
                source = HERE / name
                if not source.exists(): source = HERE.parent / 'managed-beta' / name
                shutil.copy2(source, app / name)
            common = (app / 'hyperv-common.ps1').read_text(encoding='utf-8-sig') + r'''
function Protect-ServerDirectory($Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Grant-ServerVmAccess($Store,$Vm) { }
function Get-VerifiedDownload($Url,$Destination,$Sha256) { [IO.File]::WriteAllText($Destination,'fixture') }
function Get-GuestHealth($Config) { @{Address='127.0.0.1';Data=@{phase='prepared';installId=$Config.InstallId}} }
'''
            (app / 'hyperv-common.ps1').write_text(common, encoding='utf-8-sig')
            (root / 'docker.ps1').write_text(r'''
Add-Content $env:FIXTURE_CALLS ('docker '+($args -join ' '));$global:LASTEXITCODE=0
if($args[0] -eq 'info') { 'linux' }
if($args[0] -eq 'image') { [IO.File]::WriteAllText($args[3],'fixture') }
if($args[0] -eq 'ps') { 'fixture-container' }
if($args[0] -eq 'inspect') {
 if($args.Count -eq 2) { '[{"Name":"/limix-home-11111111-1111-4111-8111-111111111111-home-1","Mounts":[{"Type":"volume","Name":"limix-home-11111111-1111-4111-8111-111111111111_cloud"}]}]' }
 else { 'true' }
}
if($env:FIXTURE_FAILURE -like 'export*' -and ($args -contains '-czf')) { $global:LASTEXITCODE=1 }
if($env:FIXTURE_FAILURE -eq 'disk' -and ($args -contains 'mkfs.ext4')) { $global:LASTEXITCODE=1 }
''', encoding='utf-8-sig')
            harness = r'''
$ErrorActionPreference='Stop'
Import-Module Microsoft.PowerShell.Security,Microsoft.PowerShell.Utility,Microsoft.PowerShell.Management -ErrorAction Stop
$env:LOCALAPPDATA=$env:FIXTURE_ROOT;$env:ProgramData=Join-Path $env:FIXTURE_ROOT 'ProgramData'
New-Item -ItemType Directory -Path (Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host') | Out-Null
@{Token=(ConvertTo-SecureString ('a'*43) -AsPlainText -Force);Image='limix-managed-home:beta';Capacity=2} | Export-Clixml (Join-Path $env:LOCALAPPDATA 'LimixBot-Managed-Host\host.xml')
function global:Import-Module { }
function global:Get-Service { @{Status='Running'} }
function global:Get-Command { @{Source=(Join-Path $env:FIXTURE_ROOT 'docker.ps1')} }
function global:Get-CimInstance { param($ClassName) if($ClassName -eq 'Win32_ComputerSystem') { @{TotalPhysicalMemory=64GB} } }
function global:Get-ScheduledTask { if($env:FIXTURE_FAILURE -like '*old-task') { [pscustomobject]@{State='Ready';Settings=@{Enabled=$true}} } else { $null } }
function global:Disable-ScheduledTask { Add-Content $env:FIXTURE_CALLS 'old task disabled' }
function global:Enable-ScheduledTask { Add-Content $env:FIXTURE_CALLS 'old task enabled' }
function global:Register-ScheduledTask { throw 'Must not request a Windows password' }
function global:Get-PSDrive { @{Free=1000GB} }
function global:Get-VM { if($env:FIXTURE_FAILURE -eq 'existing') { @{Notes='someone-else'} } elseif($global:FixtureVm) {$global:FixtureVm} }
function global:Get-VMSwitch { param($Name) if($env:FIXTURE_FAILURE -eq 'private') {@{Name=$Name;SwitchType='Private'}}else{@{Name=$Name;SwitchType='Internal'}} }
function global:Resize-VHD { }
function global:New-VM { Add-Content $env:FIXTURE_CALLS 'VM created';$global:FixtureVm=[pscustomobject]@{Id=[guid]::NewGuid();Notes='';State='Off'};$global:FixtureVm }
function global:Set-VM { param($VM,$Notes,$AutomaticStartAction) Add-Content $env:FIXTURE_CALLS ('VM auto '+$AutomaticStartAction);if($Notes){$VM.Notes=$Notes} }
function global:Set-VMFirmware { }
function global:Add-VMHardDiskDrive { }
function global:Add-VMDvdDrive { }
function global:Start-VM { Add-Content $env:FIXTURE_CALLS 'VM started' }
function global:Stop-VM { Add-Content $env:FIXTURE_CALLS 'VM stopped' }
function global:Invoke-RestMethod { Add-Content $env:FIXTURE_CALLS 'activation attempted';if($env:FIXTURE_FAILURE -like 'activate*'){throw 'Network lost after request'};@{state='starting'} }
& (Join-Path $env:FIXTURE_ROOT 'app\hyperv-setup.ps1')
'''
            (root / 'harness.ps1').write_text(harness, encoding='utf-8-sig')
            env = {k:v for k,v in os.environ.items() if k.upper() != 'PSMODULEPATH'}
            env.update(FIXTURE_ROOT=str(root),FIXTURE_CALLS=str(root / 'calls'),FIXTURE_FAILURE=failure,
                       PSModulePath=str(Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/Modules'))
            result = subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root / 'harness.ps1')],
                input=json.dumps({'Cpu':4,'MemoryGb':12,'DiskGb':120,'Switch':'Default Switch','StorageRoot':str(root)}), capture_output=True,text=True,encoding='utf-8',errors='replace',env=env,timeout=30)
            calls = (root / 'calls').read_text(encoding='utf-8-sig') if (root / 'calls').exists() else ''
            metadata = json.loads((root / 'hyperv.json').read_text(encoding='utf-8-sig')) if (root / 'hyperv.json').exists() else None
            self.assertNotIn('a'*43,result.stdout+result.stderr+calls)
            return result.returncode,calls,metadata,result.stdout+result.stderr

    def test_success_requires_preparation_before_activation_without_windows_password(self):
        code,calls,config,out=self.scenario()
        self.assertEqual(code,0,out)
        self.assertLess(calls.index('-czf'),calls.index('VM started'))
        self.assertLess(calls.index('VM started'),calls.index('activation attempted'))
        self.assertEqual(config['MigrationState'],'active')
        self.assertNotIn('ProgramData',config['Store'])
        self.assertIn('LimixCloudServer',config['Store'])
        self.assertNotIn('docker start fixture-container',calls)
        self.assertNotIn('volume rm',calls)

    def test_export_failure_restarts_original_cloud(self):
        code,calls,_,_=self.scenario('export')
        self.assertNotEqual(code,0)
        self.assertIn('docker start fixture-container',calls)
        self.assertNotIn('activation attempted',calls)

    def test_disk_failure_restarts_original_cloud(self):
        code,calls,_,_=self.scenario('disk')
        self.assertNotEqual(code,0)
        self.assertIn('docker start fixture-container',calls)
        self.assertNotIn('activation attempted',calls)

    def test_ambiguous_activation_never_starts_old_connectors(self):
        code,calls,config,_=self.scenario('activate')
        self.assertNotEqual(code,0)
        self.assertEqual(config['MigrationState'],'activation-attempted')
        self.assertNotIn('docker start fixture-container',calls)
        self.assertNotIn('VM stopped',calls)

    def test_existing_vm_is_never_overwritten(self):
        code,calls,_,_=self.scenario('existing')
        self.assertNotEqual(code,0)
        self.assertNotIn('docker stop',calls)
        self.assertNotIn('VM created',calls)

    def test_ambiguous_activation_keeps_old_startup_task_disabled(self):
        code,calls,_,_=self.scenario('activate-old-task')
        self.assertNotEqual(code,0)
        self.assertLess(calls.index('old task disabled'),calls.index('activation attempted'))
        self.assertNotIn('old task enabled',calls)

    def test_pre_activation_failure_restores_old_startup_task(self):
        code,calls,_,_=self.scenario('export-old-task')
        self.assertNotEqual(code,0)
        self.assertIn('old task enabled',calls)
        self.assertNotIn('activation attempted',calls)

    def test_private_network_cannot_start_cutover(self):
        code,calls,_,_=self.scenario('private')
        self.assertNotEqual(code,0)
        self.assertNotIn('docker stop',calls)

def load_script(name):
    spec=importlib.util.spec_from_file_location(name.replace('-','_'),HERE / (name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

class GuestTests(unittest.TestCase):
    def test_manifest_refuses_path_traversal_and_changed_transfer(self):
        module=load_script('linux-bootstrap')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'checksums.json').write_text(json.dumps({'../outside':'a'*64}))
            with self.assertRaises(ValueError):module.verify_media(root)
            (root/'data').write_text('changed');(root/'checksums.json').write_text(json.dumps({'data':'a'*64}))
            with self.assertRaises(ValueError):module.verify_media(root)

    def test_valid_transfer_hash_is_accepted(self):
        module=load_script('linux-bootstrap')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'data').write_text('fixture')
            (root/'checksums.json').write_text(json.dumps({'data':module.sha256(root/'data')}))
            module.verify_media(root)

    def test_guest_activation_requires_authentication(self):
        module=load_script('linux-health')
        handler=object.__new__(module.Handler);handler.path='/activate'
        results=[];handler.reply=lambda body,status=200:results.append(status)
        with patch.object(handler,'authorized',return_value=False):handler.do_POST()
        self.assertEqual(results,[401])

    def test_unprepared_guest_cannot_activate_even_with_valid_key(self):
        module=load_script('linux-health')
        with tempfile.TemporaryDirectory() as temp:
            module.STATE=Path(temp)
            handler=object.__new__(module.Handler);handler.path='/activate'
            results=[];handler.reply=lambda body,status=200:results.append(status)
            with patch.object(handler,'authorized',return_value=True):handler.do_POST()
            self.assertEqual(results,[409])
            self.assertFalse((module.STATE/'activated').exists())

class SeedTests(unittest.TestCase):
    def test_generated_seed_protects_credentials_and_does_not_activate_host(self):
        with tempfile.TemporaryDirectory(prefix='limix-seed-fixture-') as temp:
            root=Path(temp)
            for name in ['host.mjs','power-probe.mjs','updater.mjs','docker-backend.mjs','compose.yaml','linux-bootstrap.py','linux-health.py','hyperv-common.ps1']:
                source=HERE/name
                if not source.exists():source=HERE.parent/'managed-beta'/name
                shutil.copy2(source,root/name)
            script=". (Join-Path $PSScriptRoot 'hyperv-common.ps1'); Write-Utf8 (Join-Path $PSScriptRoot 'user-data') (New-CloudInit 'fixture' ('1'*64) ('a'*43) 2 'limix-managed-home:beta' $PSScriptRoot)"
            (root/'generate.ps1').write_text(script,encoding='utf-8-sig')
            result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'generate.ps1')],capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr)
            text=(root/'user-data').read_text()
            entries={}
            for part in text.split('  - path: ')[1:]:
                name=part.splitlines()[0]
                mode=re.search(r"permissions: '(\d+)'",part).group(1)
                content=base64.b64decode(re.search(r'content: ([A-Za-z0-9+/=]+)',part).group(1)).decode()
                entries[name]=(mode,content)
            self.assertTrue(all(mode=='0600' for name,(mode,_) in entries.items() if name.startswith('/etc/limix-server/')))
            host=entries['/etc/systemd/system/limix-cloud-host.service'][1]
            self.assertIn('Restart=always',host)
            self.assertIn('RestartSec=30',host)
            self.assertIn('WantedBy=multi-user.target',host)
            boot=entries['/etc/systemd/system/limix-cloud-bootstrap.service'][1]
            self.assertIn('TimeoutStartSec=infinity',boot)
            commands=text.split('runcmd:')[1]
            self.assertNotIn('limix-cloud-host.service',commands)
            self.assertIn('limix-cloud-health.service, limix-cloud-bootstrap.service',commands)
            self.assertNotIn('a'*43,result.stdout+result.stderr)

if __name__=='__main__':unittest.main()


