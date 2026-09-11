window.__ModuleLoader__.load({
  id: "@blockfire/harness-web",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require("react");
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    /**
     * BLOCKFIRE Harness Web surface.
     *
     * Four pieces, all additive seats in the shipped slot tree (no upstream
     * file is modified, no ChatView fork):
     *
     * 1. Update Center (Settings → BLOCKFIRE) — reads the same status the CLI
     *    prints and drives the same updater: Update (stage → verify →
     *    activate, refusing activation on a failed verify), Rollback, live
     *    job output, and a restart-required banner for a pinned-but-not-yet-
     *    running version.
     * 2. Session stats strip at `conversation.input.dock` — directly below the
     *    model's activity and above the composer card. Upstream renders the
     *    same figures at `conversation.composer.dock` (below the composer);
     *    that occupant is replaced by id with a null renderer so the figures
     *    appear exactly once, next to the work instead of under the input.
     *    The velocity entry keeps the shipped TPS icon exactly
     *    (`IconGaugeOutline16`).
     * 3. "New session" button at `sidebar.footer.action` — a small, always
     *    visible + beside Settings; upstream's per-workspace + only appears
     *    on row hover.
     * 4. Permanent delete at `conversation.session.header.utilities` — a
     *    two-step confirm that calls the host route `POST
     *    /blockfire/session/delete`, which removes the log, the projection
     *    cache entry, and the workspace accounting through the workspace
     *    storage domain (the same facility the registry writes through), so
     *    the sidebar updates live over its own change feed.
     */

    const inject = ["slots"];
    const h = React.createElement;

    // ── shared styling (theme tokens only) ───────────────────────────────────

    const LABEL = { color: "var(--dsw-alias-label-secondary)", fontSize: 12, minWidth: 190 };
    const VALUE = { color: "var(--dsw-alias-label-primary)", fontSize: 13, wordBreak: "break-word" };
    const ROW = { display: "flex", gap: 12, padding: "6px 0", alignItems: "baseline" };
    const CARD = {
      border: "1px solid var(--dsw-alias-border-l1)",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 14,
      background: "var(--dsw-alias-bg-layer-1)",
    };
    const BUTTON = {
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 13,
      cursor: "pointer",
      color: "var(--dsw-alias-label-primary)",
      background: "var(--dsw-alias-bg-layer-2)",
    };
    const CODE = {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      color: "var(--dsw-alias-label-primary)",
      background: "var(--dsw-alias-bg-layer-2)",
      border: "1px solid var(--dsw-alias-border-l1)",
      borderRadius: 6,
      padding: "2px 6px",
      display: "inline-block",
    };

    function row(label, value, tone) {
      const style = tone === undefined ? VALUE : Object.assign({}, VALUE, { color: tone });
      return h("div", { style: ROW, key: label }, [
        h("div", { style: LABEL, key: "l" }, label),
        h("div", { style: style, key: "v" }, value),
      ]);
    }

    // ── 1. Update Center (drives the existing update.mjs mechanism) ─────────

    const PRE = {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 11,
      lineHeight: "16px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      margin: "8px 0 0",
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid var(--dsw-alias-border-l1)",
      background: "var(--dsw-alias-bg-layer-2)",
      color: "var(--dsw-alias-label-secondary)",
      maxHeight: 180,
      overflowY: "auto",
    };
    const BANNER_OK = {
      border: "1px solid var(--dsw-alias-state-success-primary)",
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 10,
      color: "var(--dsw-alias-state-success-primary)",
      fontSize: 12,
    };
    const BANNER_WARN = {
      border: "1px solid var(--dsw-alias-state-warn-primary)",
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 10,
      color: "var(--dsw-alias-state-warn-primary)",
      fontSize: 12,
    };

    const ACTION_LABEL = {
      update: "Update",
      rollback: "Rollback",
      check: "Check",
      stage: "Stage",
      verify: "Verify",
      activate: "Activate",
    };

    /** Live view of one update operation (stage → verify → activate, or rollback). */
    function JobView({ job }) {
      if (job === null) return null;
      const head = `${ACTION_LABEL[job.action] ?? job.action}${job.version ? ` → ${job.version}` : ""}`;
      const running = job.state === "running";
      const tone = running
        ? "var(--dsw-alias-label-secondary)"
        : job.ok === true
          ? "var(--dsw-alias-state-success-primary)"
          : "var(--dsw-alias-state-error-primary)";
      return h("div", { style: { marginTop: 10 }, key: "job" }, [
        h("div", { style: { fontSize: 12, color: tone }, key: "head" }, running ? `${head} — running…` : `${head} — ${job.ok === true ? "done" : "failed"}`),
        job.output
          ? h("pre", { style: PRE, key: "out" }, job.output)
          : running
            ? h("div", { style: Object.assign({}, VALUE, { fontSize: 12, marginTop: 6 }), key: "wait" }, "Working — first output appears here as soon as the updater prints it.")
            : null,
      ]);
    }

    function UpdateCenter() {
      const [state, setState] = React.useState({ phase: "loading" });
      const [job, setJob] = React.useState(null);
      const [busyAction, setBusyAction] = React.useState(false);
      const [selected, setSelected] = React.useState(undefined);
      const load = React.useCallback((withCheck) => {
        setState((previous) => Object.assign({}, previous, { phase: "loading" }));
        fetch(withCheck === true ? "/blockfire/update?check=1" : "/blockfire/update", { headers: { accept: "application/json" } })
          .then((response) => response.json())
          .then((payload) => {
            if (payload && payload.ok === true) setState({ phase: "ready", payload: payload });
            else setState({ phase: "error", message: (payload && payload.error) || "unknown error" });
          })
          .catch((error) => setState({ phase: "error", message: String(error && error.message ? error.message : error) }));
      }, []);
      React.useEffect(() => {
        load(false);
      }, [load]);

      const startAction = React.useCallback((action, version) => {
        if (busyAction) return;
        setBusyAction(true);
        setJob({ state: "running", action, version: version || null, output: "" });
        fetch("/blockfire/update/action", {
          method: "POST",
          headers: { "content-type": "application/json", "x-blockfire-update": "1" },
          body: JSON.stringify({ action, version }),
        })
          .then((response) => response.json())
          .then((payload) => {
            if (!(payload && payload.ok === true)) throw new Error((payload && payload.error) || "could not start the operation");
            setJob({ state: "running", action, version: version || null, output: "", id: payload.jobId });
          })
          .catch((cause) => {
            setBusyAction(false);
            setJob({ state: "done", ok: false, action, version: version || null, output: String(cause && cause.message ? cause.message : cause) });
          });
      }, [busyAction]);

      // Poll the running job until it settles; a settled job refreshes status.
      const jobId = job !== null ? job.id : null;
      const jobRunning = job !== null && job.state === "running";
      React.useEffect(() => {
        if (!jobRunning || jobId === null) return undefined;
        const timer = setInterval(() => {
          fetch("/blockfire/update/job", { headers: { accept: "application/json" } })
            .then((response) => response.json())
            .then((payload) => {
              if (!(payload && payload.ok === true)) return;
              setJob(payload.job);
              if (payload.job.state !== "running") {
                setBusyAction(false);
                load(false);
              }
            })
            .catch(() => {});
        }, 1500);
        return () => clearInterval(timer);
      }, [jobRunning, jobId, load]);

      if (state.phase === "loading" && state.payload === undefined) return h("div", { style: VALUE }, "Reading update state…");
      if (state.phase === "error") {
        return h("div", null, [
          h("div", { style: Object.assign({}, VALUE, { color: "var(--dsw-alias-state-error-primary)" }), key: "e" }, `Update Center unavailable: ${state.message}`),
          h("div", { style: { marginTop: 10 }, key: "c" }, h("code", { style: CODE }, "harness/install.sh")),
        ]);
      }

      const payload = state.payload;
      const status = payload.status || {};
      const active = status.active || null;
      const previous = status.previous || null;
      const running = status.runningInstall || null;
      const staged = Object.keys(status.staged || {});
      const verified = status.verified || {};
      const check = payload.check || null;
      const newer = check && Array.isArray(check.newer) ? check.newer : [];
      const channels = check && Array.isArray(check.channels) ? check.channels : [];

      // Candidate picker: what upstream publishes plus what is already staged,
      // minus the version this launcher is pinned to. Nothing is hardcoded.
      const seen = new Set();
      const choices = [];
      for (const entry of newer) {
        if (!seen.has(entry.version) && (!active || entry.version !== active.version)) { seen.add(entry.version); choices.push(entry.version); }
      }
      for (const version of staged) {
        if (!seen.has(version) && (!active || version !== active.version)) { seen.add(version); choices.push(version); }
      }
      const restartNeeded = active !== null && running !== null && active.version !== running.version;
      const activatedNow = job !== null && job.state === "done" && job.ok === true && (job.action === "update" || job.action === "activate");
      const rolledBackNow = job !== null && job.state === "done" && job.ok === true && job.action === "rollback";
      const loading = state.phase === "loading";
      const chosen = selected !== undefined && choices.includes(selected) ? selected : choices[0];

      return h("div", null, [
        restartNeeded
          ? h("div", { style: BANNER_WARN, key: "restart" }, `Restart required: version ${active.version} is pinned and runs on the NEXT launch — this process is still on ${running.version}.`)
          : null,
        activatedNow
          ? h("div", { style: BANNER_OK, key: "ok" }, `Activated ${job.version}. Restart the harness to run it; the previous version stays available for rollback below.`)
          : null,
        rolledBackNow
          ? h("div", { style: BANNER_OK, key: "rb" }, `Rolled back to ${job.version === null ? "the previous version" : job.version}. Restart the harness to run it.`)
          : null,
        h("div", { style: CARD, key: "now" }, [
          h("div", { style: { fontWeight: 600, marginBottom: 6, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "Runtime"),
          row(
            "running now",
            running ? `${running.version}${running.sourceLabel ? ` — ${running.sourceLabel}` : ""}` : "unknown",
          ),
          row("launcher pin (next launch)", active ? active.version : "none — resolver default"),
          row("rollback target", previous ? previous.version : "none"),
          row(
            "staged candidates",
            staged.length === 0 ? "none" : staged.map((version) => `${version} ${verified[version] ? (verified[version].ok ? "[verified]" : "[failed]") : "[unverified]"}`).join(", "),
          ),
          previous !== null
            ? h("div", { style: { marginTop: 8 }, key: "rb-btn" },
                h("button", { style: BUTTON, disabled: busyAction || loading, onClick: () => startAction("rollback") }, `Rollback to ${previous.version}`))
            : null,
        ]),
        h("div", { style: CARD, key: "up" }, [
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, key: "head" }, [
            h("div", { style: { fontWeight: 600, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "Upstream"),
            h("button", { style: BUTTON, disabled: busyAction || loading, key: "b", onClick: () => load(true) }, check === null ? "Check now" : "Re-check"),
          ]),
          check === null
            ? h("div", { style: VALUE, key: "n" }, "Not checked yet in this process. Nothing is installed or replaced by checking.")
            : h("div", { key: "c" }, [
                ...channels.map((channel) => {
                  const label = channel.notesUrl
                    ? h("span", null, [channel.version, " ", h("a", { href: channel.notesUrl, target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary)" }, key: "a" }, "release notes")])
                    : channel.version;
                  return h("div", { key: `ch-${channel.channel}` }, [
                    row(`channel ${channel.channel}`, label),
                    channel.notes
                      ? h("details", { key: "notes", style: { margin: "0 0 6px 190px" } }, [
                          h("summary", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", cursor: "pointer" } }, "notes"),
                          h("pre", { style: PRE }, channel.notes),
                        ])
                      : null,
                  ]);
                }),
                newer.length === 0
                  ? row("newer versions", "none published", "var(--dsw-alias-state-success-primary)")
                  : row("newer versions", newer.map((entry) => entry.version).join(", "), "var(--dsw-alias-state-warn-primary)"),
              ]),
        ]),
        h("div", { style: CARD, key: "act" }, [
          h("div", { style: { fontWeight: 600, marginBottom: 6, color: "var(--dsw-alias-label-primary)" }, key: "t" }, "Update"),
          h("div", { style: Object.assign({}, VALUE, { marginBottom: 8 }), key: "p" }, "One button runs the existing updater: stage into an isolated tree, verify the BLOCKFIRE suite against it, and activate only if it passed. The running process is never touched — a switch applies on the next launch, with the previous version kept for rollback. A failed verify stops everything and shows the suite's output below."),
          choices.length === 0
            ? h("div", { style: Object.assign({}, VALUE, { fontSize: 12 }), key: "none" }, "No candidate available. Check upstream first; a published release then appears here on its own.")
            : h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, key: "row" }, [
                h("select", {
                  key: "sel",
                  value: chosen,
                  onChange: (event) => setSelected(event.target.value),
                  style: Object.assign({}, BUTTON, { padding: "5px 8px" }),
                }, choices.map((version) => h("option", { key: version, value: version }, version))),
                h("button", { style: BUTTON, disabled: busyAction || loading, onClick: () => startAction("update", chosen) }, `Update to ${chosen}`),
              ]),
          h(JobView, { job, key: "job" }),
        ]),
      ]);
    }

    // ── 2. session stats (below the live activity, above the composer) ──────

    const STAT = {
      color: "var(--dsw-alias-label-secondary)",
      fontSize: 12,
      lineHeight: "18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      columnGap: 14,
      rowGap: 2,
      padding: "4px 16px 6px",
      width: "100%",
      boxSizing: "border-box",
    };
    const STAT_GROUP = { display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" };
    const STAT_ICON = { display: "inline-flex", alignItems: "center", color: "var(--dsw-alias-label-secondary)" };

    function fmtDuration(ms) {
      const s = Math.max(0, ms) / 1000;
      if (s < 1) return `${Math.round(s * 10) / 10}s`;
      if (s < 60) return `${Math.round(s * 10) / 10}s`;
      if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
      return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
    }
    function fmtTps(tps) {
      const clamped = Math.max(0, tps);
      return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
    }
    function fmtTokens(value) {
      const scaled = (candidate) => (candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10));
      if (value < 1000) return String(value);
      if (value < 1e6) return `${scaled(value / 1e3)}k`;
      return `${scaled(value / 1e6)}M`;
    }

    function statGroup(icon, text, key) {
      return h("span", { style: STAT_GROUP, key }, [
        icon === undefined ? null : h("span", { style: STAT_ICON, key: "i" }, icon),
        text,
      ]);
    }

    /** All durable session figures, live, without hiding fields on narrow views. */
    function StatsStrip({ useProjection }) {
      if (useProjection === undefined) return null;
      const stats = useProjection("sessionStats");
      const usage = useProjection("tokenUsage");
      const groups = [];
      if (stats !== undefined && stats !== null && stats.steps > 0) {
        groups.push(statGroup(undefined, `${stats.turns} ${stats.turns === 1 ? "turn" : "turns"} · ${stats.steps} steps`, "counts"));
        if (stats.llmMs > 0) groups.push(statGroup(h(primitives.IconClockOutline16, { key: "llm-i" }), `LLM ${fmtDuration(stats.llmMs)}`, "llm"));
        if (stats.toolMs > 0) groups.push(statGroup(h(primitives.IconClockOutline16, { key: "tool-i" }), `Tools ${fmtDuration(stats.toolMs)}`, "tools"));
        if (stats.ttftSteps > 0) groups.push(statGroup(h(primitives.IconClockOutline16, { key: "ttft-i" }), `TTFT ${fmtDuration(stats.ttftMs / stats.ttftSteps)}`, "ttft"));
        if (stats.decodeMs > 0) {
          groups.push(statGroup(h(primitives.IconGaugeOutline16, { key: "speed-i" }), `${fmtTps(stats.decodeTokens / (stats.decodeMs / 1000))} tok/s`, "speed"));
        }
      }
      if (usage !== undefined && usage !== null) {
        const billed = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
        if (billed > 0) {
          const hit = Math.round((usage.cacheReadTokens / billed) * 1000) / 10;
          groups.push(statGroup(h(primitives.IconDatabaseOutline16, { key: "cache-i" }), `Cache ${hit}%`, "cache"));
        }
        if (billed > 0 || usage.outputTokens > 0) {
          groups.push(statGroup(
            h(primitives.IconDatabaseOutline16, { key: "io-i" }),
            `In ${fmtTokens(billed)} · Out ${fmtTokens(usage.outputTokens)}`,
            "tokens",
          ));
        }
      }
      if (groups.length === 0) return null;
      return h("div", { style: STAT, title: "Session stats" }, groups);
    }

    function NullStats() {
      return null;
    }

    // ── 3. new-session button (sidebar footer) ───────────────────────────────

    function NewSessionButton({ pluginCtx }) {
      const [busy, setBusy] = React.useState(false);
      const uiWorkspace = pluginCtx.get("uiWorkspace");
      if (uiWorkspace === undefined) return null;
      const onClick = () => {
        if (busy) return;
        setBusy(true);
        try {
          uiWorkspace.startSession();
        } finally {
          setBusy(false);
        }
      };
      return h(
        "button",
        {
          type: "button",
          "aria-label": "New session",
          title: "New session",
          onClick,
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            cursor: "pointer",
            border: "1px solid var(--dsw-alias-border-l2)",
            borderRadius: 8,
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-primary)",
            padding: "4px 8px",
            fontSize: 12,
            lineHeight: "16px",
          },
        },
        [
          h("span", { style: { display: "inline-flex", alignItems: "center" }, key: "i" }, h(primitives.IconPlusOutline16, { key: "p" })),
          h("span", { key: "t" }, "New"),
        ],
      );
    }

    // ── 4. permanent delete (session header utilities) ───────────────────────

    const DELETE = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      cursor: "pointer",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: 6,
      background: "transparent",
      color: "var(--dsw-alias-label-tertiary)",
      padding: "2px 8px",
      fontSize: 12,
      lineHeight: "18px",
    };
    const DELETE_ARMED = Object.assign({}, DELETE, {
      color: "var(--dsw-alias-state-error-primary)",
      borderColor: "var(--dsw-alias-state-error-primary)",
    });

    let armedDeleteFor = null;

    function DeleteSessionButton({ sessionId, uiWorkspace, workspaces }) {
      const [, setTick] = React.useState(0);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const armed = armedDeleteFor === sessionId;
      React.useEffect(() => {
        if (armedDeleteFor !== null && armedDeleteFor !== sessionId) {
          armedDeleteFor = null;
          setTick((tick) => tick + 1);
        }
        setError(null);
      }, [sessionId]);

      const run = () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        fetch("/blockfire/session/delete", {
          method: "POST",
          headers: { "content-type": "application/json", "x-blockfire-delete": "1" },
          body: JSON.stringify({ sessionId }),
        })
          .then((response) => response.json())
          .then((payload) => {
            if (!(payload && payload.ok === true)) throw new Error((payload && payload.error) || "delete failed");
            armedDeleteFor = null;
            disarm();
            const deadline = Date.now() + 3000;
            const leave = () => {
              const snapshot = workspaces !== undefined ? workspaces.list.getSnapshot() : undefined;
              const gone =
                snapshot === undefined ||
                snapshot.items === undefined ||
                snapshot.items.every((item) => item === null || item.sessionIds === undefined || !item.sessionIds.includes(sessionId));
              if (gone || Date.now() > deadline) uiWorkspace.startSession();
              else setTimeout(leave, 120);
            };
            leave();
          })
          .catch((cause) => {
            setError(String(cause && cause.message ? cause.message : cause));
            setBusy(false);
          });
      };

      const disarm = () => {
        setBusy(false);
        setTick((tick) => tick + 1);
      };

      return h("div", { style: { display: "inline-flex", alignItems: "center", gap: 6 } }, [
        h(
          "button",
          {
            type: "button",
            key: "b",
            style: armed ? DELETE_ARMED : DELETE,
            disabled: busy,
            "aria-label": armed ? "Confirm permanent delete" : "Delete session permanently",
            title: armed ? "Click again to delete permanently" : "Delete permanently",
            onClick: () => {
              if (busy) return;
              if (armed) run();
              else {
                armedDeleteFor = sessionId;
                setTick((tick) => tick + 1);
              }
            },
          },
          [
            h("span", { style: { display: "inline-flex", alignItems: "center" }, key: "i" }, h(primitives.IconTrashOutline16, { key: "t" })),
            armed ? "Delete forever?" : "Delete",
          ],
        ),
        error === null
          ? null
          : h("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12 }, key: "e" }, error),
      ]);
    }

    // ── registration ─────────────────────────────────────────────────────────

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      slots.inject("settings.section", () =>
        slots.register({ name: "settings.section", id: "blockfire-update", order: 25, label: "BLOCKFIRE" }, UpdateCenter),
      );

      const workspaces = ctx.get("workspaces");

      slots.inject("sidebar.footer.action", () =>
        slots.register(
          { name: "sidebar.footer.action", id: "blockfire-new-session", order: 0, label: "New session" },
          () => NewSessionButton({ pluginCtx: ctx }),
        ),
      );

      slots.inject("conversation.input.dock", () =>
        slots.register({ name: "conversation.input.dock", id: "blockfire-stats", order: -10, label: "Session stats" }, StatsStrip),
      );

      slots.inject("conversation.composer.dock", () =>
        slots.register({ name: "conversation.composer.dock", id: "stats", priority: -1, order: 0, label: "Session stats" }, NullStats),
      );

      slots.inject("conversation.session.header.utilities", () =>
        slots.register(
          { name: "conversation.session.header.utilities", id: "blockfire-delete", order: 50, label: "Delete permanently" },
          (props) => {
            const sessionId = props !== undefined ? props.sessionId : undefined;
            const uiWorkspace = ctx.get("uiWorkspace");
            if (sessionId === undefined || uiWorkspace === undefined) return null;
            return DeleteSessionButton({ sessionId, uiWorkspace, workspaces });
          },
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
