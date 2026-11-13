import { describe, it, expect } from 'vitest';
import { migrateLocalVmName, perBotLocalVmTarget, MANAGED_LABEL, WORKSPACE_LABEL, TARGET_LABEL, type CommandRunner } from './container-computer.ts';
describe('Limix container names', () => {
  const target = perBotLocalVmTarget('rename-fixture');
  const old = target.containerName.replace('limixbot-computer', 'openmausbot-computer');
  const owned = JSON.stringify([{Config:{Labels:{[MANAGED_LABEL]:'1',[WORKSPACE_LABEL]:'1',[TARGET_LABEL]:target.label}}}]);
  it('renames a legacy owned Docker container and preserves the container itself', async () => {
    const calls: string[][] = [];
    const run: CommandRunner = async (_runtime,args) => { calls.push(args); if(args[0]==='inspect' && args[1]===target.containerName) throw Error('missing'); return {stdout:owned}; };
    await migrateLocalVmName('docker',target,run);
    expect(calls).toEqual([['inspect',target.containerName],['inspect',old],['rename',old,target.containerName]]);
  });
  it('leaves containers without matching ownership alone', async () => {
    const calls:string[][]=[];
    const run:CommandRunner=async (_runtime,args)=>{calls.push(args);if(args[1]===target.containerName)throw Error('missing');return {stdout:'[{"Config":{"Labels":{}}}]'};};
    await migrateLocalVmName('docker',target,run);
    expect(calls.some(args=>args[0]==='rename')).toBe(false);
  });
  it('propagates a rename failure so provisioning cannot silently create a duplicate', async () => {
    const run:CommandRunner=async (_runtime,args)=>{if(args[0]==='inspect' && args[1]===old)return {stdout:owned};throw Error('unavailable');};
    await expect(migrateLocalVmName('docker',target,run)).rejects.toThrow('unavailable');
  });
});
