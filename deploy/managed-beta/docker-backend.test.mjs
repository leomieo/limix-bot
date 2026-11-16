import { test } from "node:test";
import assert from "node:assert/strict";
import { dockerInvocation } from "./docker-backend.mjs";
test("native Docker remains default", () => assert.equal(dockerInvocation(["ps"], {}).file,"docker"));
test("WSL maps Windows compose paths and passes secrets through environment only", () => {
 const r=dockerInvocation(["compose","-f", "D:\\limix bot\\compose.yaml","up"],{LIMIX_DOCKER_WSL_DISTRO:"LimixCloud",LIMIX_HOME_SECRET:"fixture-secret",LIMIX_BETA_HOST_TOKEN:"host-secret",WSLENV:"LIMIX_BETA_HOST_TOKEN/u"});
 assert.equal(r.file,"wsl.exe");assert(r.args.includes("/mnt/d/limix bot/compose.yaml"));
 assert(!r.args.join(" ").includes("fixture-secret"));assert.equal(r.env.LIMIX_HOME_SECRET,"fixture-secret");
 assert.equal(r.env.LIMIX_BETA_HOST_TOKEN,undefined);assert(!r.env.WSLENV.includes("LIMIX_BETA_HOST_TOKEN"));
});
test("WSL distro cannot inject command arguments",()=>assert.throws(()=>dockerInvocation([],{LIMIX_DOCKER_WSL_DISTRO:"bad --exec"})));
