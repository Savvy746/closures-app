/* Format a JS value like a browser console would (compact). */
function formatValue(v, depth = 0, seen = new Set()) {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const t = typeof v;
  if (t === "string") return depth === 0 ? v : `'${v}'`;
  if (t === "number" || t === "boolean") return String(v);
  if (t === "bigint") return String(v) + "n";
  if (t === "function") return v.name ? `[Function: ${v.name}]` : "[Function (anonymous)]";
  if (t === "symbol") return v.toString();
  if (seen.has(v)) return "[Circular]";
  seen.add(v);
  try {
    if (Array.isArray(v)) {
      const items = v.map((x) => formatValue(x, depth + 1, seen));
      return `[ ${items.join(", ")} ]`.replace("[  ]", "[]");
    }
    if (v instanceof Error) return v.name + ": " + v.message;
    if (v instanceof Map) {
      const items = [...v.entries()].map(([k, val]) => `${formatValue(k, depth+1, seen)} => ${formatValue(val, depth+1, seen)}`);
      return `Map(${v.size}) { ${items.join(", ")} }`;
    }
    if (v instanceof Set) {
      const items = [...v.values()].map((x) => formatValue(x, depth+1, seen));
      return `Set(${v.size}) { ${items.join(", ")} }`;
    }
    if (v instanceof Promise) return "Promise { <pending> }";
    const keys = Object.keys(v);
    const inner = keys.map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${formatValue(v[k], depth + 1, seen)}`);
    const ctor = v.constructor && v.constructor.name && v.constructor.name !== "Object" ? v.constructor.name + " " : "";
    return `${ctor}{ ${inner.join(", ")} }`.replace("{  }", "{}");
  } finally {
    seen.delete(v);
  }
}


/* ============================================================
   Execution engine
   Runs user JS, captures console output in real order, including
   async output from setTimeout / Promises. Output streams in via
   an onLog callback. Returns a cleanup that disables late logs.
   ============================================================ */
export function runCode(source, onLog, onDone) {
  let live = true;
  let pending = 0;          // outstanding async timers
  let settleTimer = null;

  const push = (method, args) => {
    if (!live) return;
    const text = args
      .map((a) => formatValue(a))
      .join(" ");
    onLog({ method, text });
  };

  // Native timers captured before we shadow them
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);

  const timers = new Set();
  const intervals = new Set();

  let doneCalled = false;
  const tryDone = () => {
    if (doneCalled) return;
    // wait until no pending timers and a tick passes
    if (pending <= 0) {
      doneCalled = true;
      live && onDone && onDone();
    }
  };

  // sandboxed console
  const sandboxConsole = {
    log: (...a) => push("log", a),
    info: (...a) => push("info", a),
    warn: (...a) => push("warn", a),
    error: (...a) => push("error", a),
    debug: (...a) => push("log", a),
  };

  // sandboxed timers that track pending count so we know when async is done
  const sbSetTimeout = (fn, ms, ...rest) => {
    pending++;
    const id = realSetTimeout(() => {
      try { typeof fn === "function" && fn(...rest); }
      catch (e) { push("error", [String(e)]); }
      finally { pending--; scheduleDone(); }
    }, Math.min(ms || 0, 2000)); // cap delays so lessons run fast
    timers.add(id);
    return id;
  };
  const sbClearTimeout = (id) => { realClearTimeout(id); timers.delete(id); };

  let intervalGuard = 0;
  const sbSetInterval = (fn, ms, ...rest) => {
    pending++;
    let ticks = 0;
    const id = realSetInterval(() => {
      ticks++;
      if (!live || ticks > 50) { sbClearInterval(id); return; }
      try { typeof fn === "function" && fn(...rest); }
      catch (e) { push("error", [String(e)]); sbClearInterval(id); }
    }, Math.min(ms || 0, 500));
    intervals.add(id);
    return id;
  };
  const sbClearInterval = (id) => {
    realClearInterval(id);
    if (intervals.has(id)) { intervals.delete(id); pending--; scheduleDone(); }
  };

  function scheduleDone() {
    if (settleTimer) realClearTimeout(settleTimer);
    settleTimer = realSetTimeout(tryDone, 30);
  }

  // Build the function with shadowed globals
  let fn;
  try {
    fn = new Function(
      "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "alert", "window", "globalThis", "self", "document",
      `"use strict";\n${source}`
    );
  } catch (e) {
    push("error", [String(e)]);
    onDone && onDone();
    return () => { live = false; };
  }

  // Run synchronously; capture sync errors
  try {
    fn(
      sandboxConsole, sbSetTimeout, sbClearTimeout, sbSetInterval, sbClearInterval,
      () => {}, undefined, undefined, undefined, undefined
    );
  } catch (e) {
    push("error", [String(e)]);
  }

  // microtask + settle pass: lets promise callbacks flush, then finalize
  Promise.resolve().then(() => realSetTimeout(scheduleDone, 0));
  scheduleDone();

  return () => {
    live = false;
    timers.forEach((id) => realClearTimeout(id));
    intervals.forEach((id) => realClearInterval(id));
  };
}



