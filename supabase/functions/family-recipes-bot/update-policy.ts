export type UpdateStatus='processing'|'retryable'|'done';
export function canClaimUpdate(status:UpdateStatus|null,leaseExpired:boolean):boolean{
  return status===null||status==='retryable'||(status==='processing'&&leaseExpired);
}
export function classifyFailure(stage:'handler'|'telegram',kind:'validation'|'transient'|'ambiguous'): 'done'|'retryable'|'manual_review' {
  if(kind==='ambiguous')return 'manual_review';
  if(stage==='handler'&&kind==='validation')return 'done';
  return 'retryable';
}
