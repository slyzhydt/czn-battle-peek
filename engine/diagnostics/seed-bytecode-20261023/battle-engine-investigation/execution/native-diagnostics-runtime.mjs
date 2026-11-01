// Default packaged bootstrap, not a live override identity assertion.
// bootstrap/gamecore.bootstrap.js: ContentError 0x2a00 constructs class0x1900;
// ResourceError0x4100 constructs class0x3100. Both return the Error object.
// A caller's explicit `throw ContentError(...)` remains a separate operation.
export class NativeContentError extends Error {
  constructor(uctx,message,args){super(message);this.name='ContentError';this.uctx=uctx;this.args=args;}
}
export class NativeResourceError extends Error {
  constructor(message,value,channel){super(message);this.name='ResourceError';this.value=value;this.channel=channel;}
}
export class NativeDiagnosticsRuntime {
  constructor(e){this.e=e;}
  contentError(message,args){return new NativeContentError(Object.hasOwn(this.e.wt,'uctx')?this.e.wt.uctx:this.e.state.uctx,message,args);}
  ContentError(message,args){return this.contentError(message,args);}
  ResourceError(message,value,channel){return new NativeResourceError(message,value,channel);}
}
