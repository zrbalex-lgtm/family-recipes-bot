import { assertEquals } from "jsr:@std/assert@1";
import { canClaimUpdate, classifyFailure } from "./update-policy.ts";
Deno.test("claim new, retryable, or expired processing only",()=>{
  assertEquals(canClaimUpdate(null,false),true);
  assertEquals(canClaimUpdate('retryable',false),true);
  assertEquals(canClaimUpdate('processing',false),false);
  assertEquals(canClaimUpdate('processing',true),true);
  assertEquals(canClaimUpdate('done',true),false);
});
Deno.test("do not silently mark transient or ambiguous failures done",()=>{
  assertEquals(classifyFailure('handler','validation'),'done');
  assertEquals(classifyFailure('handler','transient'),'retryable');
  assertEquals(classifyFailure('telegram','transient'),'retryable');
  assertEquals(classifyFailure('telegram','ambiguous'),'manual_review');
});
