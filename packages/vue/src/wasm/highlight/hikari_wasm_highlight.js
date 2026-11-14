"use components";
function __jcoEmbeddedRuntime$promiseWithResolvers() {
	if (Promise.withResolvers) return Promise.withResolvers();
	let resolve;
	let reject;
	return {
		promise: new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		}),
		resolve,
		reject
	};
}
function __jcoEmbeddedRuntime$isPromiseLike(value) {
	return value !== null && (typeof value == "object" || typeof value == "function") && typeof value.then == "function";
}
const __jcoEmbeddedRuntime$debugLog = (...args) => {
	if (!globalThis?.process?.env?.JCO_DEBUG) return;
	console.debug(...args);
};
const __jcoEmbeddedRuntime$initializeTaskRegisters = () => ({});
function __jcoEmbeddedRuntime$validate(args) {
	if (!args) throw TypeError("args missing");
	if (args.taskID === void 0) throw TypeError("missing task ID");
	if (args.threadID === void 0) throw TypeError("missing thread ID");
	if (args.componentIdx === void 0) throw TypeError("missing component idx");
}
const __jcoEmbeddedRuntime$getCurrentTaskMeta = (registers, componentIdx) => {
	let value = componentIdx == null ? registers.current : registers[componentIdx];
	return value == null ? void 0 : { ...value };
};
const __jcoEmbeddedRuntime$setCurrentTaskMeta = (registers, args) => {
	__jcoEmbeddedRuntime$validate(args);
	let { taskID, threadID, componentIdx } = args;
	return registers.current = registers[componentIdx] = {
		taskID,
		threadID,
		componentIdx
	};
};
function __jcoEmbeddedRuntime$withCurrentTaskMeta(registers, args) {
	__jcoEmbeddedRuntime$debugLog("[_withGlobalCurrentThreadMeta()] args", args);
	__jcoEmbeddedRuntime$validate(args);
	if (!args.fn) throw TypeError("missing fn");
	let { taskID, threadID, componentIdx, fn } = args;
	let previous = registers[componentIdx] ?? null;
	let previousCurrent = registers.current ?? null;
	try {
		registers.current = registers[componentIdx] = {
			taskID,
			threadID,
			componentIdx
		};
		return fn();
	} catch (error) {
		__jcoEmbeddedRuntime$debugLog("error while executing sync callee/callback", {
			...args,
			err: error
		});
		throw error;
	} finally {
		registers[componentIdx] = previous;
		registers.current = previousCurrent;
	}
}
function __jcoEmbeddedRuntime$withCurrentTaskMetaAsync(registers, args) {
	__jcoEmbeddedRuntime$debugLog("[_withGlobalCurrentThreadMetaAsync()] args", args);
	__jcoEmbeddedRuntime$validate(args);
	if (!args.fn) throw TypeError("missing fn");
	let { taskID, threadID, componentIdx, fn } = args;
	let previous = registers[componentIdx] ?? null;
	let previousCurrent = registers.current ?? null;
	let result;
	try {
		registers.current = registers[componentIdx] = {
			taskID,
			threadID,
			componentIdx
		};
		result = fn();
	} catch (error) {
		__jcoEmbeddedRuntime$debugLog("error while executing sync callee/callback", {
			...args,
			err: error
		});
		registers[componentIdx] = previous;
		registers.current = previousCurrent;
		throw error;
	}
	if (!__jcoEmbeddedRuntime$isPromiseLike(result)) {
		registers[componentIdx] = previous;
		registers.current = previousCurrent;
		return result;
	}
	return (async () => {
		try {
			return await result;
		} catch (error) {
			__jcoEmbeddedRuntime$debugLog("error while executing async callee/callback", {
				...args,
				err: error
			});
			throw error;
		} finally {
			registers[componentIdx]?.threadID === threadID && registers[componentIdx]?.taskID === taskID && (registers[componentIdx] = null);
			registers.current?.threadID === threadID && registers.current?.taskID === taskID && (registers.current = null);
		}
	})();
}
const __jcoEmbeddedRuntime$clearCurrentTaskMeta = async (registers, args) => {
	__jcoEmbeddedRuntime$debugLog("[_clearCurrentTask()] args", args);
	__jcoEmbeddedRuntime$validate(args);
	let { taskID, threadID, componentIdx } = args;
	let meta = registers[componentIdx];
	if (!meta) throw Error(`missing current thread meta for component idx [${componentIdx}]`);
	if (meta.threadID !== threadID) throw Error(`thread ID [${meta.threadID}] != requested ID [${threadID}]`);
	if (meta.taskID !== taskID) throw Error(`task ID [${meta.taskID}] != requested ID [${taskID}]`);
	if (meta.componentIdx !== componentIdx) throw Error(`component idx [${meta.componentIdx}] != requested idx [${componentIdx}]`);
	registers[componentIdx] = null;
	registers.current?.threadID === threadID && registers.current?.taskID === taskID && (registers.current = null);
};
const __jcoEmbeddedRuntime$reportTrap = (context, err) => {
	let { storeTrap, RuntimeError } = context;
	if (storeTrap.onTrap === null || storeTrap.stopped) return;
	if (!(err instanceof RuntimeError) || storeTrap.trapsReported.has(err)) return;
	storeTrap.trapsReported.add(err);
	let trap = __jcoEmbeddedRuntime$normalizeCoreTrap(context.normalization, err);
	try {
		storeTrap.onTrap(trap);
	} catch (e) {
		queueMicrotask(() => {
			throw e;
		});
	}
};
function __jcoEmbeddedRuntime$isIdle(context) {
	if (context.storeTrap.error !== null) return !0;
	for (let [componentIdx, metas] of context.tasks) if (componentIdx !== -1 && metas.length > 0) return !1;
	return !0;
}
const __jcoEmbeddedRuntime$checkIdle = (context) => {
	context.checkCalls?.();
	let { idleWaiters } = context.storeAsyncState;
	if (idleWaiters.size === 0 || !__jcoEmbeddedRuntime$isIdle(context)) return;
	let waiters = [...idleWaiters];
	idleWaiters.clear();
	for (let resolve of waiters) resolve();
};
const __jcoEmbeddedRuntime$whenIdle = (context) => {
	if (__jcoEmbeddedRuntime$isIdle(context)) return Promise.resolve();
	return new Promise((resolve) => {
		context.storeAsyncState.idleWaiters.add(resolve);
	});
};
const __jcoEmbeddedRuntime$stopInstance = (context) => {
	let { storeTrap, storeAsyncState, asyncState, symbolDispose } = context;
	if (storeTrap.stopped) return;
	storeTrap.stopped = !0;
	let err = new context.RuntimeError("component instance has been stopped");
	storeTrap.error ??= err;
	clearTimeout(storeAsyncState.deadlockCheck);
	storeAsyncState.deadlockCheck = null;
	for (let state of asyncState.values()) state.markTrapped(err);
	for (let reject of storeTrap.stopWaiters) reject(err);
	storeTrap.stopWaiters.clear();
	let pending = [...context.tasks.values()].flat().map((meta) => meta.task);
	for (let task of pending) task.stop(err);
	for (let state of asyncState.values()) state.stop();
	let errors = [];
	for (let channels of context.channels) for (let i = 2, data = channels.data(); i < data.length; i += 2) {
		let channel = data[i];
		if (channel === void 0 || channel === context.RepTable.FREE) continue;
		try {
			channel.onInstanceStop?.();
		} catch (e) {
			errors.push(e);
		}
	}
	let resources = new Set();
	for (let { handles, captures } of storeTrap.resourceTables) for (let i = 2; i < handles.length; i += 2) {
		if (handles[i] & 1073741824 || !(handles[i + 1] >= __jcoEmbeddedRuntime$tableOwn)) continue;
		let resource = captures.get(handles[i + 1] - __jcoEmbeddedRuntime$tableOwn);
		resource !== void 0 && resources.add(resource);
	}
	for (let { captures } of storeTrap.resourceTables) captures.clear();
	storeTrap.resourceTables.length = 0;
	for (let resource of resources) {
		if (storeTrap.disposed.has(resource)) continue;
		try {
			resource[symbolDispose]?.();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length) throw AggregateError(errors, "failed to dispose stopped instance resources");
};
const __jcoEmbeddedRuntime$initializeInstanceFlags = () => new Map();
const __jcoEmbeddedRuntime$initializeStoreTrap = (onTrap = null) => ({
	error: null,
	stopped: !1,
	resourceTables: [],
	stopWaiters: new Set(),
	disposed: new WeakSet(),
	onTrap,
	trapsReported: new WeakSet()
});
const __jcoEmbeddedRuntime$initializeStoreAsyncState = () => ({
	deadlockCheck: null,
	pendingHostOperations: 0,
	idleWaiters: new Set()
});
const __jcoEmbeddedRuntime$initializeComponentAsyncStates = () => new Map();
const __jcoEmbeddedRuntime$initializeCoreTrapMessages = (messages) => new Map(Object.entries(messages));
function __jcoEmbeddedRuntime$normalizeCoreTrap(context, err) {
	let { RuntimeError, messages: trapMessages } = context;
	if (!(err instanceof RuntimeError)) return err;
	let message = trapMessages.get(err.message);
	message !== void 0 && (err.message = message);
	return err;
}
function __jcoEmbeddedRuntime$checkForDeadlock(context) {
	let { RuntimeError, storeAsyncState, storeTrap, asyncState } = context;
	if (storeAsyncState.deadlockCheck !== null || storeTrap.error !== null) return;
	storeAsyncState.deadlockCheck = setTimeout(() => {
		storeAsyncState.deadlockCheck = null;
		if (storeTrap.error !== null || storeAsyncState.pendingHostOperations > 0) return;
		let suspendedTasks = new Set();
		for (let state of asyncState.values()) {
			if (state.hasPendingSchedulerWork()) {
				state.runTickLoop();
				return;
			}
			for (let meta of state.suspendedTaskMetas()) suspendedTasks.add(meta.task);
		}
		let unresolvedRoots = new Set();
		for (let task of suspendedTasks) {
			let root = task.getRootTask();
			root.isResolvedState() || unresolvedRoots.add(root);
		}
		if (unresolvedRoots.size === 0) return;
		let err = new RuntimeError("wasm trap: deadlock detected: event loop cannot make further progress");
		err.deadlockDetail = {
			pendingHostOperations: storeAsyncState.pendingHostOperations,
			suspendedTasks: [...suspendedTasks].map((task) => ({
				taskID: task.id(),
				componentIdx: task.componentIdx(),
				state: task.taskState(),
				rootTaskID: task.getRootTask().id()
			})),
			unresolvedRootTaskIDs: [...unresolvedRoots].map((root) => root.id())
		};
		storeTrap.error = err;
		for (let root of unresolvedRoots) {
			root.setErrored(err);
			root.reject(err);
		}
		for (let task of suspendedTasks) if (!task.isResolvedState() && unresolvedRoots.has(task.getRootTask())) {
			task.setErrored(err);
			task.reject(err);
		}
		for (let state of asyncState.values()) state.markTrapped(err);
		for (let state of asyncState.values()) state.abandonLockWaiters();
		for (let state of asyncState.values()) state.abandonAdmissionWaiters();
		for (let state of asyncState.values()) state.runTickLoop();
	}, 0);
}
function __jcoEmbeddedRuntime$trackHostOperation(context, operation) {
	let { storeAsyncState, asyncState, symbolDispose, storeTrap } = context;
	if (storeTrap.stopped) throw storeTrap.error;
	let result = operation();
	if (!__jcoEmbeddedRuntime$isPromiseLike(result)) {
		if (storeTrap.stopped) throw storeTrap.error;
		return result;
	}
	storeAsyncState.pendingHostOperations++;
	let rejectStopped;
	let stopped = new Promise((_, reject) => {
		rejectStopped = reject;
	});
	storeTrap.stopWaiters.add(rejectStopped);
	storeTrap.stopped && rejectStopped(storeTrap.error);
	let tracked = Promise.race([result, stopped]).finally(() => {
		storeTrap.stopWaiters.delete(rejectStopped);
		storeAsyncState.pendingHostOperations--;
		if (storeAsyncState.pendingHostOperations < 0) throw Error("negative pending host operation count");
		for (let state of asyncState.values()) state.runTickLoop();
		__jcoEmbeddedRuntime$checkForDeadlock(context);
	});
	for (let sym of [Symbol.asyncDispose, symbolDispose]) typeof sym == "symbol" && typeof result[sym] == "function" && (tracked[sym] = () => result[sym]());
	return tracked;
}
function __jcoEmbeddedRuntime$checkMayLeave(context, componentIdx) {
	let { RuntimeError, instanceFlags } = context;
	if (instanceFlags.get(componentIdx)?.value !== 1) throw new RuntimeError("cannot leave component instance");
}
function __jcoEmbeddedRuntime$guardMayLeave(context, componentIdx, fn) {
	return function(...args) {
		__jcoEmbeddedRuntime$checkMayLeave(context, componentIdx);
		return fn.apply(this, args);
	};
}
function __jcoEmbeddedRuntime$recordTrap(context, componentIdx, err, convertsRangeErrors = !1) {
	let { RuntimeError, registers: currentTaskMeta } = context;
	convertsRangeErrors && err instanceof RangeError && (err = new RuntimeError("out of bounds memory access"));
	if (err instanceof RuntimeError) {
		let idx = componentIdx ?? currentTaskMeta.current?.componentIdx;
		idx != null && __jcoEmbeddedRuntime$getOrCreateAsyncState(context.lookup, idx).markTrapped(err);
	}
	return err;
}
function __jcoEmbeddedRuntime$guardTrap(context, componentIdx, fn, convertsRangeErrors = !1) {
	return function(...args) {
		try {
			return fn.apply(this, args);
		} catch (err) {
			throw __jcoEmbeddedRuntime$recordTrap(context, componentIdx, err, convertsRangeErrors);
		}
	};
}
function __jcoEmbeddedRuntime$getOrCreateAsyncState(context, componentIdx) {
	let { asyncState, ComponentAsyncState } = context;
	if (!asyncState.has(componentIdx)) {
		let newState = new ComponentAsyncState({ componentIdx });
		asyncState.set(componentIdx, newState);
	}
	return asyncState.get(componentIdx);
}
const __jcoEmbeddedRuntime$TICK_DONE = "done";
const __jcoEmbeddedRuntime$TICK_RESUMED = "resumed";
const __jcoEmbeddedRuntime$TICK_IDLE = "idle";
function __jcoEmbeddedRuntime$initializeComponentAsyncStateClass(context) {
	let { RuntimeError, RepTable, indexSpaces, instanceFlags, storeTrap, normalization, cannotEnter, deadlock, Waitable } = context;
	class ComponentAsyncState {
		static EVENT_HANDLER_EVENTS = ["backpressure-change"];
		static TickResult = {
			DONE: __jcoEmbeddedRuntime$TICK_DONE,
			RESUMED: __jcoEmbeddedRuntime$TICK_RESUMED,
			IDLE: __jcoEmbeddedRuntime$TICK_IDLE
		};
		#componentIdx;
		#callingAsyncImport = !1;
		#syncImportWait = __jcoEmbeddedRuntime$promiseWithResolvers();
		#lockHolderTaskID = null;
		#lockWaiters = [];
		#admissionQueue = [];
		#lockHandoffScheduled = !1;
		#pendingTaskStarts = 0;
		#suspendedThreadsByRef = new Map();
		#errored = null;
		#trapped = !1;
		#trapError = null;
		#backpressure = 0;
		#backpressureWaiters = 0n;
		#handlers = [];
		#nextHandlerID = 0n;
		#tickLoop = null;
		#onExclusiveReleaseHandlers = [];
		#mayLeave = !0;
		handles;
		subtasks;
		threads;
		constructor(args) {
			this.#componentIdx = args.componentIdx;
			this.handles = new RepTable({
				target: `component [${this.#componentIdx}] handles (waitable objects)`,
				space: __jcoEmbeddedRuntime$getHandleIndexSpace(indexSpaces, this.#componentIdx)
			});
			this.subtasks = new RepTable({ target: `component [${this.#componentIdx}] subtasks` });
			this.threads = new RepTable({ target: `component [${this.#componentIdx}] threads` });
		}
		componentIdx() {
			return this.#componentIdx;
		}
		get mayLeave() {
			let flags = instanceFlags.get(this.#componentIdx);
			return flags === void 0 ? this.#mayLeave : flags.value === 1;
		}
		set mayLeave(value) {
			if (typeof value != "boolean") throw TypeError("mayLeave must be a boolean");
			this.#mayLeave = value;
			let flags = instanceFlags.get(this.#componentIdx);
			flags !== void 0 && (flags.value = +!!value);
		}
		errored() {
			return this.#errored !== null;
		}
		setErrored(err) {
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#setErrored()] component errored", {
				err,
				componentIdx: this.#componentIdx
			});
			if (this.#errored) return;
			err ||= Object.assign(Error("error elswehere (see other component instance error)"), { componentIdx: this.#componentIdx });
			this.#errored = err;
		}
		markTrapped(err) {
			if (!(err instanceof RuntimeError)) return !1;
			let trap = __jcoEmbeddedRuntime$normalizeCoreTrap(normalization, err);
			this.#trapped = !0;
			this.#trapError === null && (this.#trapError = trap);
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#markTrapped()] component trapped", {
				err,
				componentIdx: this.#componentIdx
			});
			storeTrap.error === null && (storeTrap.error = trap);
			context.reportTrap?.(trap);
			context.checkIdle?.();
			return !0;
		}
		isTrapped() {
			return this.#trapped;
		}
		throwIfInterrupted() {
			if (storeTrap.stopped) throw storeTrap.error;
			if (this.#trapped) throw this.#trapError ?? new RuntimeError(cannotEnter);
		}
		throwIfTrapped() {
			if (storeTrap.stopped) throw storeTrap.error;
			if (this.#trapped) throw new RuntimeError(cannotEnter);
		}
		callingSyncImport(val) {
			if (val === void 0) return this.#callingAsyncImport;
			if (typeof val != "boolean") throw TypeError("invalid setting for async import");
			let prev = this.#callingAsyncImport;
			this.#callingAsyncImport = val;
			prev === !0 && this.#callingAsyncImport === !1 && this.#notifySyncImportEnd();
		}
		#notifySyncImportEnd() {
			let existing = this.#syncImportWait;
			this.#syncImportWait = __jcoEmbeddedRuntime$promiseWithResolvers();
			existing.resolve();
		}
		async waitForSyncImportCallEnd() {
			await this.#syncImportWait.promise;
		}
		setBackpressure(v) {
			this.#backpressure = v;
			for (let handler of this.#handlers.filter((handler) => handler.event === "backpressure-change")) handler.fn(v);
			return this.#backpressure;
		}
		getBackpressure() {
			return this.#backpressure;
		}
		incrementBackpressure() {
			let current = this.#backpressure;
			if (current < 0 || current > 2 ** 16) throw Error(`invalid current backpressure value [${current}]`);
			let newValue = this.getBackpressure() + 1;
			if (newValue >= 2 ** 16) throw Error(`invalid new backpressure value [${newValue}], overflow`);
			return this.setBackpressure(newValue);
		}
		decrementBackpressure() {
			let current = this.#backpressure;
			if (current < 0 || current > 2 ** 16) throw Error(`invalid current backpressure value [${current}]`);
			let newValue = current - 1;
			if (newValue < 0) throw new RuntimeError("backpressure counter underflow");
			return this.setBackpressure(newValue);
		}
		hasBackpressure() {
			return this.#backpressure > 0;
		}
		waitForBackpressure() {
			if (!this.hasBackpressure()) return Promise.resolve(null);
			this.addBackpressureWaiter();
			return new Promise((resolve) => {
				let pending = !0;
				let handlerID = this.registerHandler({
					event: "backpressure-change",
					fn: (bp) => {
						if (bp !== 0 || !pending) return;
						pending = !1;
						this.removeHandler({
							event: "backpressure-change",
							handlerID
						});
						this.removeBackpressureWaiter();
						resolve(null);
					}
				});
			});
		}
		registerHandler(args) {
			let { event, fn } = args;
			if (!event) throw Error("missing handler event");
			if (!fn) throw Error("missing handler fn");
			if (!ComponentAsyncState.EVENT_HANDLER_EVENTS.includes(event)) throw Error(`unrecognized event handler [${event}]`);
			let handlerID = this.#nextHandlerID++;
			this.#handlers.push({
				id: handlerID,
				fn,
				event
			});
			return handlerID;
		}
		removeHandler(args) {
			let { event, handlerID } = args;
			this.#handlers = this.#handlers.filter((handler) => handler.event !== event || handler.id !== handlerID);
		}
		getBackpressureWaiters() {
			return this.#backpressureWaiters;
		}
		addBackpressureWaiter() {
			this.#backpressureWaiters++;
		}
		removeBackpressureWaiter() {
			this.#backpressureWaiters--;
			if (this.#backpressureWaiters < 0) throw Error("unexepctedly negative number of backpressure waiters");
		}
		isExclusivelyLocked() {
			return this.#lockHolderTaskID !== null;
		}
		exclusivelyLockedBy(taskID) {
			return this.#lockHolderTaskID === taskID;
		}
		exclusiveLock(taskID) {
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#exclusiveLock()]", {
				holder: this.#lockHolderTaskID,
				requester: taskID,
				componentIdx: this.#componentIdx
			});
			if (taskID == null) throw Error("exclusive lock requires the acquiring task id");
			if (this.#lockHolderTaskID !== null) throw Error(`component [${this.#componentIdx}] exclusive lock held by task [${this.#lockHolderTaskID}], requested by [${taskID}]`);
			this.#lockHolderTaskID = taskID;
		}
		acquireExclusiveLock(taskID) {
			if (taskID == null) throw Error("exclusive lock requires the acquiring task id");
			if (this.#lockHolderTaskID === null) {
				this.#lockHolderTaskID = taskID;
				__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#acquireExclusiveLock()] acquired", {
					holder: taskID,
					componentIdx: this.#componentIdx
				});
				return;
			}
			if (this.#lockHolderTaskID === taskID) throw Error(`task [${taskID}] already holds the lock for component [${this.#componentIdx}]`);
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#acquireExclusiveLock()] waiting", {
				holder: this.#lockHolderTaskID,
				requester: taskID,
				componentIdx: this.#componentIdx,
				queued: this.#lockWaiters.length
			});
			return new Promise((resolve) => {
				this.#lockWaiters.push({
					taskID,
					resolve
				});
			});
		}
		takeAdmissionTicket(taskID) {
			let ticket = {
				taskID,
				...__jcoEmbeddedRuntime$promiseWithResolvers()
			};
			this.#admissionQueue.push(ticket);
			return ticket;
		}
		hasPendingAdmissions() {
			return this.#admissionQueue.length > 0;
		}
		waitForAdmissionTurn(ticket) {
			if (this.#admissionQueue[0] === ticket) return;
			return ticket.promise;
		}
		releaseAdmissionTicket(ticket) {
			let idx = this.#admissionQueue.indexOf(ticket);
			if (idx === -1) return;
			this.#admissionQueue.splice(idx, 1);
			idx === 0 && this.#admissionQueue.length > 0 && this.#admissionQueue[0].resolve();
		}
		abandonAdmissionWaiters() {
			let tickets = this.#admissionQueue.splice(0);
			for (let ticket of tickets) ticket.resolve();
		}
		abandonLockWaiters() {
			let waiters = this.#lockWaiters.splice(0);
			for (let waiter of waiters) waiter.resolve();
		}
		cancelExclusiveLockWaiter(taskID) {
			let idx = this.#lockWaiters.findIndex((waiter) => waiter.taskID === taskID);
			if (idx === -1) return !1;
			let [waiter] = this.#lockWaiters.splice(idx, 1);
			waiter.resolve();
			return !0;
		}
		exclusiveRelease(taskID) {
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#exclusiveRelease()] args", {
				holder: this.#lockHolderTaskID,
				releaser: taskID,
				componentIdx: this.#componentIdx
			});
			if (this.#lockHolderTaskID !== taskID) {
				__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#exclusiveRelease()] ignoring foreign release", {
					holder: this.#lockHolderTaskID,
					releaser: taskID,
					componentIdx: this.#componentIdx
				});
				return !1;
			}
			this.#lockHolderTaskID = null;
			this.#onExclusiveReleaseHandlers = this.#onExclusiveReleaseHandlers.filter((v) => !!v);
			for (let [idx, f] of this.#onExclusiveReleaseHandlers.entries()) try {
				this.#onExclusiveReleaseHandlers[idx] = null;
				f();
			} catch (err) {
				__jcoEmbeddedRuntime$debugLog("error while executing handler for next exclusive release", err);
				throw err;
			}
			this.#scheduleLockHandoff();
			return !0;
		}
		#scheduleLockHandoff() {
			if (this.#lockHandoffScheduled || this.#lockWaiters.length === 0) return;
			this.#lockHandoffScheduled = !0;
			queueMicrotask(() => {
				this.#lockHandoffScheduled = !1;
				if (this.#lockHolderTaskID !== null) return;
				let next = this.#lockWaiters.shift();
				if (!next) return;
				this.#lockHolderTaskID = next.taskID;
				next.resolve();
			});
		}
		onNextExclusiveRelease(fn) {
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#()onNextExclusiveRelease] registering");
			this.#onExclusiveReleaseHandlers.push(fn);
		}
		async waitForExclusiveRelease() {
			for (; this.isExclusivelyLocked();) await new Promise((resolve) => this.onNextExclusiveRelease(resolve));
		}
		#getSuspendedTaskMeta(taskID) {
			let metas = [...this.#suspendedThreadsByRef.values()].filter((meta) => meta.thread.taskID() === taskID);
			return metas.find((meta) => meta.cancellable && this.suspendedThreadReady(meta.thread)) ?? metas[0];
		}
		suspendTask(args) {
			let { task, ...opts } = args;
			task.endFirstSlice();
			return this.suspendThread({
				thread: task.defaultThread(),
				...opts
			});
		}
		resumeTaskByID(taskID) {
			let meta = this.#getSuspendedTaskMeta(taskID);
			return meta ? this.resumeThread(meta.thread) : !1;
		}
		suspendedTaskReady(taskID) {
			let meta = this.#getSuspendedTaskMeta(taskID);
			return meta ? this.suspendedThreadReady(meta.thread) : !1;
		}
		suspendedTaskCancellable(taskID) {
			return !!this.#getSuspendedTaskMeta(taskID)?.cancellable;
		}
		isTaskSuspended(taskID) {
			return !!this.#getSuspendedTaskMeta(taskID);
		}
		*suspendedTaskMetas() {
			for (let meta of this.#suspendedThreadsByRef.values()) yield {
				...meta,
				task: meta.thread.task()
			};
		}
		#removeSuspendedThreadMeta(thread) {
			let meta = this.#suspendedThreadsByRef.get(thread);
			this.#suspendedThreadsByRef.delete(thread);
			return meta;
		}
		suspendThread(args) {
			let { thread, readyFn, cancellable, onResume, suspended = !1 } = args;
			__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#suspendThread()]", {
				threadID: thread.id(),
				taskID: thread.taskID(),
				componentIdx: this.#componentIdx
			});
			if (thread.componentIdx() !== this.#componentIdx) throw Error("assert: thread component idx should match async state");
			if (this.#suspendedThreadsByRef.has(thread)) throw Error(`thread [${thread.id()}] already suspended`);
			let promise;
			let resume;
			if (onResume) resume = () => onResume(!thread.isCancelled() && !thread.isRejected() && !this.isTrapped());
			else {
				let resolvers = __jcoEmbeddedRuntime$promiseWithResolvers();
				promise = resolvers.promise;
				resume = () => resolvers.resolve(!thread.isCancelled() && !thread.isRejected() && !this.isTrapped());
			}
			if (storeTrap.stopped) {
				this.markTrapped(storeTrap.error);
				resume();
				return promise;
			}
			this.#suspendedThreadsByRef.set(thread, {
				thread,
				cancellable,
				readyFn,
				resume,
				suspended
			});
			thread.notifyProgress();
			this.runTickLoop();
			__jcoEmbeddedRuntime$checkForDeadlock(deadlock);
			return promise;
		}
		resumeThread(thread) {
			let meta = this.#removeSuspendedThreadMeta(thread);
			if (!meta) return !1;
			meta.resume();
			return !0;
		}
		markThreadReady(thread) {
			let meta = this.#suspendedThreadsByRef.get(thread);
			if (!meta || !meta.suspended) return !1;
			meta.suspended = !1;
			meta.readyFn = () => !0;
			this.runTickLoop();
			return !0;
		}
		isThreadSuspended(thread) {
			return this.#suspendedThreadsByRef.get(thread)?.suspended ?? !1;
		}
		isThreadReady(thread) {
			let meta = this.#suspendedThreadsByRef.get(thread);
			return !!meta && !meta.suspended && (meta.thread.isRejected() || meta.readyFn());
		}
		suspendedThreadReady(thread) {
			let meta = this.#suspendedThreadsByRef.get(thread);
			if (!meta) return !1;
			if (!meta.readyFn) throw Error(`suspended thread [${thread.id()}] is missing a readiness function`);
			if (this.isTrapped() || meta.thread.isRejected()) return !0;
			if (!meta.readyFn()) return !1;
			let task = meta.thread.task();
			return !task.needsExclusiveLock() || !this.isExclusivelyLocked() || this.exclusivelyLockedBy(task.id());
		}
		addPendingTaskStart() {
			this.#pendingTaskStarts++;
		}
		removePendingTaskStart() {
			this.#pendingTaskStarts--;
		}
		hasPendingSchedulerWork() {
			if (this.#pendingTaskStarts > 0) return !0;
			if (this.#lockHandoffScheduled) return !0;
			for (let meta of this.#suspendedThreadsByRef.values()) if (this.suspendedThreadReady(meta.thread)) return !0;
			return !1;
		}
		stop() {
			this.#tickLoop !== null && clearTimeout(this.#tickLoop);
			this.#tickLoop = null;
			this.abandonLockWaiters();
			this.abandonAdmissionWaiters();
			for (let thread of [...this.#suspendedThreadsByRef.keys()]) this.resumeThread(thread);
		}
		runTickLoop() {
			if (storeTrap.stopped || this.#tickLoop !== null) return;
			let run = () => {
				if (storeTrap.stopped) {
					this.#tickLoop = null;
					return;
				}
				let result = this.tick();
				if (storeTrap.stopped || result === __jcoEmbeddedRuntime$TICK_DONE) {
					this.#tickLoop = null;
					return;
				}
				result === __jcoEmbeddedRuntime$TICK_IDLE && __jcoEmbeddedRuntime$checkForDeadlock(deadlock);
				let delay = result === __jcoEmbeddedRuntime$TICK_RESUMED ? 0 : 10;
				this.#tickLoop = setTimeout(run, delay);
			};
			this.#tickLoop = setTimeout(run, 10);
		}
		tick() {
			for (let [thread, meta] of this.#suspendedThreadsByRef) {
				if (!meta || !meta.readyFn) throw Error(`missing/invalid thread meta despite thread [${thread.id()}] being present`);
				if (this.isTrapped() || meta.thread.isRejected()) {
					__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#tick()] detected thread rejection, leaving early", { meta });
					this.resumeThread(thread);
					return __jcoEmbeddedRuntime$TICK_RESUMED;
				}
				if (!this.suspendedThreadReady(thread)) continue;
				__jcoEmbeddedRuntime$debugLog("[ComponentAsyncState#tick()] resuming thread via tick", {
					threadID: thread.id(),
					componentIdx: this.#componentIdx
				});
				this.resumeThread(thread);
				return __jcoEmbeddedRuntime$TICK_RESUMED;
			}
			return this.#suspendedThreadsByRef.size > 0 ? __jcoEmbeddedRuntime$TICK_IDLE : __jcoEmbeddedRuntime$TICK_DONE;
		}
		createWaitable(args) {
			return new Waitable({ target: args?.target });
		}
	}
	return ComponentAsyncState;
}
const __jcoEmbeddedRuntime$postReturnTrap = (context, componentIdx, error) => {
	let trap;
	if (error instanceof context.RuntimeError) trap = error;
	else {
		let message = /call stack|stack overflow|too much recursion/i.test(error?.message ?? "") ? context.stackOverflow : context.uncaughtException;
		trap = new context.RuntimeError(message, { cause: error });
	}
	__jcoEmbeddedRuntime$getOrCreateAsyncState(context.lookup, componentIdx).markTrapped(trap);
	return trap;
};
function __jcoEmbeddedRuntime$getCurrentTask(_context, componentIdx, taskID) {
	if (componentIdx == null) throw Error("missing component idx");
	let taskMetas = _context.tasks.get(componentIdx);
	if (taskMetas === void 0 || taskMetas.length === 0) return;
	if (taskID) return taskMetas.find((meta) => meta.task.id() === taskID);
	let current = _context.registers[componentIdx];
	if (current && current.taskID !== void 0) {
		let currentMeta = taskMetas.find((meta) => meta.task.id() === current.taskID);
		if (currentMeta) return currentMeta;
	}
	let taskMeta = taskMetas[taskMetas.length - 1];
	if (!taskMeta || !taskMeta.task) return;
	return taskMeta;
}
function __jcoEmbeddedRuntime$createNewCurrentImplicitThread(_context, args) {
	__jcoEmbeddedRuntime$debugLog("[createNewCurrentImplicitThread()] args", args);
	let { componentIdx, isAsync, isManualAsync, preserveFutureResult, entryFnName, callbackFnName, getCallbackFn, stringEncoding, errHandling, getCalleeParamsFn, resultPtr, callingWasmExport } = args;
	if (componentIdx == null) throw Error("missing/invalid component instance index while starting task");
	let taskMetas = _context.tasks.get(componentIdx);
	let callbackFn = getCallbackFn ? getCallbackFn() : null;
	let newTask = new _context.AsyncTask({
		componentIdx,
		isAsync,
		isManualAsync,
		preserveFutureResult,
		entryFnName,
		callbackFn,
		callbackFnName,
		stringEncoding,
		getCalleeParamsFn,
		resultPtr,
		errHandling,
		callingWasmExport
	});
	let thread = newTask.addThread(new _context.AsyncThread({
		componentIdx,
		task: newTask
	}));
	let newTaskID = newTask.id();
	let newTaskMeta = {
		id: newTaskID,
		componentIdx,
		task: newTask
	};
	_context.taskIds.push(newTaskID);
	_context.componentIdxs.push(componentIdx);
	if (taskMetas) taskMetas.push(newTaskMeta);
	else {
		taskMetas = [newTaskMeta];
		_context.tasks.set(componentIdx, [newTaskMeta]);
	}
	return {
		task: newTask,
		taskID: newTaskID,
		thread,
		threadID: thread.id()
	};
}
function __jcoEmbeddedRuntime$clearCurrentThread(_context, componentIdx, taskID, options = {}) {
	__jcoEmbeddedRuntime$debugLog("[clearCurrentThread()] args", {
		componentIdx,
		taskID
	});
	if (componentIdx == null) throw Error("missing/invalid component instance index while ending current task");
	let tasks = _context.tasks.get(componentIdx);
	if (!tasks || !Array.isArray(tasks)) throw Error("missing/invalid tasks for component instance while ending task");
	if (tasks.length == 0) throw Error(`no current tasks for component instance [${componentIdx}] while ending task`);
	let taskIdx = taskID === void 0 ? tasks.length - 1 : tasks.findIndex((meta) => meta.id === taskID);
	if (taskIdx === -1) return;
	let taskMeta = tasks[taskIdx];
	if (!options.preserveTask) {
		tasks.splice(taskIdx, 1);
		_context.checkIdle?.();
	}
	let globalTaskIdx = _context.taskIds.lastIndexOf(taskMeta.id);
	if (globalTaskIdx !== -1) {
		_context.taskIds.splice(globalTaskIdx, 1);
		_context.componentIdxs.splice(globalTaskIdx, 1);
	}
	return taskMeta.task;
}
const __jcoEmbeddedRuntime$RESOURCE_TABLE_FLAG = 1 << 30;
const __jcoEmbeddedRuntime$RESOURCE_TABLE_OWN = 2 ** 32;
const __jcoEmbeddedRuntime$tableOwn = __jcoEmbeddedRuntime$RESOURCE_TABLE_OWN;
const __jcoEmbeddedRuntime$initializeHandleIndexSpaces = () => new Map();
const __jcoEmbeddedRuntime$initializeHandleTables = () => [];
const __jcoEmbeddedRuntime$initializeCurrentBorrows = () => ({ borrows: [] });
const __jcoEmbeddedRuntime$initializeResourceScopeCounter = () => ({ value: 0 });
const __jcoEmbeddedRuntime$initializeResourceScopeTasks = () => new Map();
const __jcoEmbeddedRuntime$getHandleIndexSpace = (spaces, key) => {
	let space = spaces.get(key);
	if (space === void 0) {
		space = {
			next: 1,
			free: [],
			alloc() {
				return this.free.length > 0 ? this.free.pop() : this.next++;
			},
			release(index) {
				this.free.push(index);
			}
		};
		spaces.set(key, space);
	}
	return space;
};
const __jcoEmbeddedRuntime$tableCreateOwn = (spaces, table, rep) => {
	rep >>>= 0;
	table._createdReps.add(rep);
	let handle = __jcoEmbeddedRuntime$getHandleIndexSpace(spaces, table._componentIdx ?? table).alloc();
	table[handle << 1] = 0;
	table[(handle << 1) + 1] = rep + __jcoEmbeddedRuntime$RESOURCE_TABLE_OWN;
	return handle;
};
const __jcoEmbeddedRuntime$tableRemove = (context, table, handle) => {
	let scope = table[handle << 1];
	let value = table[(handle << 1) + 1];
	let own = value >= __jcoEmbeddedRuntime$RESOURCE_TABLE_OWN;
	let rep = own ? value - __jcoEmbeddedRuntime$RESOURCE_TABLE_OWN : value;
	if (value === void 0 || scope & __jcoEmbeddedRuntime$RESOURCE_TABLE_FLAG) throw new context.RuntimeError("unknown handle index " + handle);
	if (own && scope !== 0) throw new context.RuntimeError("cannot remove owned resource while borrowed");
	let borrowTask = own ? void 0 : context.scopeTasks.get(scope);
	table[handle << 1] = __jcoEmbeddedRuntime$RESOURCE_TABLE_FLAG;
	table[(handle << 1) + 1] = 0;
	__jcoEmbeddedRuntime$getHandleIndexSpace(context.indexSpaces, table._componentIdx ?? table).release(handle);
	borrowTask?.removeBorrowedHandle();
	return {
		rep,
		scope,
		own
	};
};
const __jcoEmbeddedRuntime$isInt8 = (value) => typeof value == "number" && value === value << 24 >> 24;
const __jcoEmbeddedRuntime$isUint8 = (value) => typeof value == "number" && value === (value & 255);
const __jcoEmbeddedRuntime$isInt16 = (value) => typeof value == "number" && value === value << 16 >> 16;
const __jcoEmbeddedRuntime$isUint16 = (value) => typeof value == "number" && value === (value & 65535);
const __jcoEmbeddedRuntime$isInt32 = (value) => typeof value == "number" && value === (value | 0);
const __jcoEmbeddedRuntime$isUint32 = (value) => typeof value == "number" && value === value >>> 0;
const __jcoEmbeddedRuntime$isInt64 = (value) => typeof value == "bigint" && value === BigInt.asIntN(64, value);
const __jcoEmbeddedRuntime$isUint64 = (value) => typeof value == "bigint" && value === BigInt.asUintN(64, value);
function __jcoEmbeddedRuntime$invalidNumericPrimitive(type, value) {
	throw TypeError(`invalid ${type} value [${value}]`);
}
const __jcoEmbeddedRuntime$toUint64 = (context, value) => {
	let converted = BigInt(value);
	context.strict && !__jcoEmbeddedRuntime$isUint64(converted) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u64", converted);
	return BigInt.asUintN(64, converted);
};
const __jcoEmbeddedRuntime$isValidNumericPrimitive = (type, value) => {
	switch (type) {
		case "bool": return value === 0 || value === 1;
		case "s8": return __jcoEmbeddedRuntime$isInt8(value);
		case "u8": return __jcoEmbeddedRuntime$isUint8(value);
		case "s16": return __jcoEmbeddedRuntime$isInt16(value);
		case "u16": return __jcoEmbeddedRuntime$isUint16(value);
		case "s32": return __jcoEmbeddedRuntime$isInt32(value);
		case "u32": return __jcoEmbeddedRuntime$isUint32(value);
		case "s64": return __jcoEmbeddedRuntime$isInt64(value);
		case "u64": return __jcoEmbeddedRuntime$isUint64(value);
		case "f32":
		case "f64": return typeof value == "number";
		default: return !1;
	}
};
const __jcoEmbeddedRuntime$requireValidNumericPrimitive = (type, value) => {
	__jcoEmbeddedRuntime$isValidNumericPrimitive(type, value) || __jcoEmbeddedRuntime$invalidNumericPrimitive(type, value);
	return !0;
};
function __jcoEmbeddedRuntime$getCurrentThread(context, componentIdx, threadID, taskID) {
	if (componentIdx === -1 || threadID == null || threadID === 0) return;
	let thread = __jcoEmbeddedRuntime$getOrCreateAsyncState(context.lookup, componentIdx).threads.get(threadID);
	if (!thread || taskID !== void 0 && thread.taskID() !== taskID) return;
	return {
		id: threadID,
		componentIdx,
		taskID: thread.taskID(),
		task: thread.task(),
		thread
	};
}
const __jcoEmbeddedRuntime$emptyFunc = () => {};
const __jcoEmbeddedRuntime$initializeDataViewCache = () => ({ view: new DataView(new ArrayBuffer(0)) });
const __jcoEmbeddedRuntime$dataView = (context, memory) => context.view.buffer === memory.buffer ? context.view : context.view = new DataView(memory.buffer);
function __jcoEmbeddedRuntime$requireString(value) {
	if (typeof value != "string") throw TypeError("expected a string, received [" + typeof value + "]");
	return value;
}
function __jcoEmbeddedRuntime$utf8Size(s) {
	let len = 0;
	let codepoints = 0;
	for (let i = 0; i < s.length; i++) {
		let ch = s.charCodeAt(i);
		codepoints++;
		if (ch < 128) len += 1;
		else if (ch < 2048) len += 2;
		else if (ch >= 55296 && ch <= 56319 && i + 1 < s.length && (s.charCodeAt(i + 1) & 64512) == 56320) {
			len += 4;
			i++;
		} else len += 3;
	}
	return {
		len,
		codepoints
	};
}
const __jcoEmbeddedRuntime$initializeUtf8Decoder = () => new TextDecoder("utf-8", {
	fatal: !0,
	ignoreBOM: !0
});
const __jcoEmbeddedRuntime$initializeUtf8Encoder = () => new TextEncoder();
const __jcoEmbeddedRuntime$initializeUtf16Encoding = () => ({ littleEndian: new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 });
function __jcoEmbeddedRuntime$writeUtf16(context, str, ptr, memory) {
	let len = str.length;
	let out = new Uint16Array(memory.buffer, ptr, len);
	let put = context.littleEndian ? (i, ch) => {
		out[i] = ch;
	} : (i, ch) => {
		out[i] = (ch & 255) << 8 | ch >>> 8;
	};
	for (let i = 0; i < len; i++) {
		let ch = str.charCodeAt(i);
		if ((ch & 63488) == 55296) {
			if (ch < 56320 && i + 1 < len && (str.charCodeAt(i + 1) & 64512) == 56320) {
				put(i++, ch);
				ch = str.charCodeAt(i);
			} else ch = 65533;
		}
		put(i, ch);
	}
	return {
		ptr,
		len,
		codepoints: [...str].length
	};
}
function __jcoEmbeddedRuntime$writeUtf8(encoder, s, ptr, len, codepoints, memory) {
	let { read, written } = encoder.encodeInto(s, new Uint8Array(memory.buffer, ptr, len));
	if (read !== s.length || written !== len) throw Error("failed to encode whole string");
	return {
		ptr,
		len,
		codepoints
	};
}
const __jcoEmbeddedRuntime$utf16Encode = (context, value, realloc, memory) => {
	let str = __jcoEmbeddedRuntime$requireString(value);
	return __jcoEmbeddedRuntime$writeUtf16(context, str, realloc(0, 0, 2, str.length * 2), memory);
};
const __jcoEmbeddedRuntime$utf8Encode = (encoder, value, realloc, memory) => {
	let s = __jcoEmbeddedRuntime$requireString(value);
	if (s.length === 0) return {
		ptr: 1,
		len: 0
	};
	let { len, codepoints } = __jcoEmbeddedRuntime$utf8Size(s);
	return __jcoEmbeddedRuntime$writeUtf8(encoder, s, realloc(0, 0, 1, len), len, codepoints, memory);
};
const __jcoEmbeddedRuntime$compactUtf16Encode = (context, value, realloc, memory) => {
	if (typeof value != "string") throw TypeError("expected a string");
	if (value.length >= 2147483648) throw RangeError("compact UTF-16 string is too long");
	for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) > 255) {
		let encoded = __jcoEmbeddedRuntime$utf16Encode(context, value, realloc, memory);
		return {
			...encoded,
			len: (encoded.len | 2147483648) >>> 0
		};
	}
	let ptr = realloc(0, 0, 2, value.length) >>> 0;
	if (ptr % 2 != 0) throw RangeError("unaligned compact UTF-16 allocation");
	let bytes = new Uint8Array(memory.buffer, ptr, value.length);
	for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i);
	return {
		ptr,
		len: value.length
	};
};
function __jcoEmbeddedRuntime$initializeRepTableClass(context) {
	let { RuntimeError } = context;
	let free = Symbol("RepTable.free");
	class RepTable {
		static FREE = free;
		#data = [0, null];
		#size = 0;
		target;
		#space = null;
		constructor(args) {
			this.target = args?.target;
			this.#space = args?.space ?? null;
		}
		data() {
			return this.#data;
		}
		insert(val) {
			if (this.#space !== null) {
				let rep = this.#space.alloc();
				this.#data[rep << 1] = val;
				this.#data[(rep << 1) + 1] = null;
				this.#size += 1;
				return rep;
			}
			__jcoEmbeddedRuntime$debugLog("[RepTable#insert()] args", {
				val,
				target: this.target
			});
			let freeIdx = this.#data[0];
			if (freeIdx === 0) {
				this.#data.push(val);
				this.#data.push(null);
				let rep = (this.#data.length >> 1) - 1;
				__jcoEmbeddedRuntime$debugLog("[RepTable#insert()] inserted", {
					val,
					target: this.target,
					rep
				});
				this.#size += 1;
				return rep;
			}
			let placementIdx = freeIdx << 1;
			if (this.#data[placementIdx] !== free) throw Error("corrupt rep table freelist: head does not point at a freed slot");
			this.#data[0] = this.#data[placementIdx + 1];
			this.#data[placementIdx] = val;
			this.#data[placementIdx + 1] = null;
			__jcoEmbeddedRuntime$debugLog("[RepTable#insert()] inserted", {
				val,
				target: this.target,
				rep: freeIdx
			});
			this.#size += 1;
			return freeIdx;
		}
		get(rep) {
			__jcoEmbeddedRuntime$debugLog("[RepTable#get()] args", {
				rep,
				target: this.target
			});
			if (rep === 0) throw new RuntimeError("invalid resource rep during get, (cannot be 0)");
			let baseIdx = rep << 1;
			let val = this.#data[baseIdx];
			if (val === free) return;
			return val;
		}
		contains(rep) {
			__jcoEmbeddedRuntime$debugLog("[RepTable#contains()] args", {
				rep,
				target: this.target
			});
			if (rep === 0) throw Error("invalid resource rep during contains, (cannot be 0)");
			let baseIdx = rep << 1;
			let val = this.#data[baseIdx];
			return val !== free && !!val;
		}
		remove(rep) {
			__jcoEmbeddedRuntime$debugLog("[RepTable#remove()] args", {
				rep,
				target: this.target
			});
			if (rep === 0) throw Error("invalid resource rep during remove, (cannot be 0)");
			if (this.#space !== null) {
				let baseIdx = rep << 1;
				let val = this.#data[baseIdx];
				if (val === void 0 || val === free) throw new RuntimeError(`unknown handle index ${rep}`);
				this.#data[baseIdx] = free;
				this.#data[baseIdx + 1] = null;
				--this.#size;
				this.#space.release(rep);
				return val;
			}
			if (this.#data.length === 2) throw Error("invalid");
			let baseIdx = rep << 1;
			if (baseIdx >= this.#data.length) throw Error(`invalid rep [${rep}] during remove, out of range`);
			let val = this.#data[baseIdx];
			if (val === free) throw new RuntimeError(`double removal of rep [${rep}] (already freed)`);
			this.#data[baseIdx] = free;
			this.#data[baseIdx + 1] = this.#data[0];
			this.#data[0] = rep;
			--this.#size;
			return val;
		}
		size() {
			return this.#size;
		}
		clear() {
			__jcoEmbeddedRuntime$debugLog("[RepTable#clear()] args", { target: this.target });
			if (this.#space) for (let rep = 1; rep < this.#data.length / 2; rep++) this.#data[(rep << 1) + 1] === null && this.#data[rep << 1] !== free && this.#space.release(rep);
			this.#size = 0;
			this.#data = [0, null];
		}
	}
	return RepTable;
}
const __jcoEmbeddedRuntime$initializeAsyncDeterminism = (mode) => mode;
const __jcoEmbeddedRuntime$initializeRuntimeErrorConstructor = (platform) => platform.RuntimeError;
const __jcoEmbeddedRuntime$initializeSymbolCabiDispose = () => Symbol.for("cabiDispose");
const __jcoEmbeddedRuntime$initializeSymbolResourceHandle = () => Symbol("handle");
const __jcoEmbeddedRuntime$initializeSymbolResourceRep = () => Symbol.for("cabiRep");
const __jcoEmbeddedRuntime$initializeSymbolDispose = () => Symbol.dispose || Symbol.for("dispose");
const __jcoEmbeddedRuntime$initializeEndianness = () => new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const __jcoEmbeddedRuntime$initializeHasOwnProperty = () => Object.prototype.hasOwnProperty;
const __jcoEmbeddedRuntime$initializeAsyncEventCodes = () => ({
	NONE: 0,
	SUBTASK: 1,
	STREAM_READ: 2,
	STREAM_WRITE: 3,
	FUTURE_READ: 4,
	FUTURE_WRITE: 5,
	TASK_CANCELLED: 6
});
const __jcoEmbeddedRuntime$initializeComponentMemoryMap = () => new Map();
const __jcoEmbeddedRuntime$initializeFileCompileCache = (nodejsCompat) => ({
	node: !!(nodejsCompat && globalThis.process?.versions?.node),
	fs: void 0
});
const __jcoEmbeddedRuntime$coinFlip = () => Math.random() > .5;
const __jcoEmbeddedRuntime$base64Compile = (context, encoded) => {
	let host = globalThis;
	return context.WebAssembly.compile(context.nodejsCompat && host.Buffer !== void 0 ? host.Buffer.from(encoded, "base64") : Uint8Array.from(atob(encoded), (byte) => byte.charCodeAt(0)));
};
async function __jcoEmbeddedRuntime$fetchWithNode(context, url) {
	if (context.fileCache.node) {
		context.fileCache.fs = context.fileCache.fs || await import("node:fs/promises");
		return context.WebAssembly.compile(await context.fileCache.fs.readFile(url));
	}
	return fetch(url).then(context.WebAssembly.compileStreaming);
}
const __jcoEmbeddedRuntime$fetchCompile = (context, url) => context.nodejsCompat ? __jcoEmbeddedRuntime$fetchWithNode(context, url) : fetch(url).then(context.WebAssembly.compileStreaming);
const __jcoEmbeddedRuntime$instantiateCore = (platform, module, imports) => platform.instantiate(module, imports);
const __jcoEmbeddedRuntime$getErrorPayload = (hasOwnProperty, error) => {
	if (error && hasOwnProperty.call(error, "payload")) return error.payload;
	if (error instanceof Error) throw error;
	return error;
};
const __jcoEmbeddedRuntime$disposeHostValue = (disposeSymbol, value, disposeFn) => {
	if (!disposeFn) {
		if (value === null || typeof value != "object" && typeof value != "function") return;
		let disposable = value;
		if (typeof Symbol.asyncDispose == "symbol" && typeof disposable[Symbol.asyncDispose] == "function") disposeFn = disposable[Symbol.asyncDispose];
		else if (typeof disposable[disposeSymbol] == "function") disposeFn = disposable[disposeSymbol];
		else return;
	}
	let dispose = disposeFn;
	let report = (error) => console.error("[jco] error while disposing discarded host value", error);
	queueMicrotask(() => {
		try {
			let result = dispose.call(value);
			result && typeof result.then == "function" && result.then(void 0, report);
		} catch (error) {
			report(error);
		}
	});
};
function __jcoEmbeddedRuntime$lookupMemories(map, args) {
	let { componentIdx } = args ?? {};
	if (args.componentIdx === void 0) throw TypeError("missing component idx");
	let metas = map.get(componentIdx);
	if (!metas) return [];
	return args.memoryIdx === void 0 ? Object.values(metas) : metas[args.memoryIdx]?.memory;
}
function __jcoEmbeddedRuntime$initializeWaitableClass() {
	class Waitable {
		#componentIdx;
		#pendingEventFn = null;
		#promise;
		#resolve;
		#reject;
		#waitableSet = null;
		#hasSyncWaiter = !1;
		#idx = null;
		target;
		constructor(args) {
			let { componentIdx } = args;
			this.#componentIdx = componentIdx;
			this.target = args.target;
			this.#resetPromise();
		}
		componentIdx() {
			return this.#componentIdx;
		}
		isInSet() {
			return this.#waitableSet !== null;
		}
		idx() {
			return this.#idx;
		}
		setIdx(idx) {
			if (idx === 0) throw Error("waitable idx cannot be zero");
			this.#idx = idx;
		}
		setTarget(tgt) {
			this.target = tgt;
		}
		#resetPromise() {
			let { promise, resolve, reject } = __jcoEmbeddedRuntime$promiseWithResolvers();
			this.#promise = promise;
			this.#resolve = resolve;
			this.#reject = reject;
		}
		resolve() {
			this.#resolve();
		}
		reject(err) {
			this.#reject(err);
		}
		promise() {
			return this.#promise;
		}
		hasPendingEvent() {
			return this.#pendingEventFn !== null;
		}
		setPendingEvent(fn) {
			__jcoEmbeddedRuntime$debugLog("[Waitable#setPendingEvent()] args", {
				waitable: this,
				inSet: this.#waitableSet
			});
			this.#pendingEventFn = fn;
		}
		getPendingEvent() {
			__jcoEmbeddedRuntime$debugLog("[Waitable#getPendingEvent()] args", {
				waitable: this,
				inSet: this.#waitableSet,
				hasPendingEvent: this.#pendingEventFn !== null
			});
			if (this.#pendingEventFn === null) return null;
			let eventFn = this.#pendingEventFn;
			this.#pendingEventFn = null;
			let e = eventFn();
			this.#resetPromise();
			return e;
		}
		join(waitableSet) {
			__jcoEmbeddedRuntime$debugLog("[Waitable#join()] args", {
				waitable: this,
				waitableSet,
				isRemoval: waitableSet === null
			});
			if (waitableSet === void 0) throw TypeError("waitable set must be not be undefined");
			this.#waitableSet && this.#waitableSet.removeWaitable(this);
			this.#waitableSet = waitableSet;
			waitableSet && waitableSet.addWaitable(this);
		}
		drop() {
			__jcoEmbeddedRuntime$debugLog("[Waitable#drop()] args", {
				componentIdx: this.#componentIdx,
				waitable: this
			});
			this.join(null);
		}
		async waitForPendingEvent(args) {
			let { cstate } = args;
			if (!cstate) throw TypeError("missing component state");
			if (this.#waitableSet !== null || this.#hasSyncWaiter) throw Error("waitable is already in a set/has a sync waiter");
			this.#hasSyncWaiter = !0;
			try {
				await cstate.waitUntil({
					cancellable: !1,
					readyFn: () => this.hasPendingEvent()
				});
			} finally {
				this.#hasSyncWaiter = !1;
			}
		}
	}
	return Waitable;
}
const __jcoEmbeddedRuntime$initializeTasksByComponent = () => new Map();
const __jcoEmbeddedRuntime$initializeCurrentTaskIds = () => [];
const __jcoEmbeddedRuntime$initializeCurrentComponentIdxs = () => [];
const __jcoEmbeddedRuntime$initializeCurrentTaskMayBlock = (platform) => {
	if (platform === !1) return !1;
	let Global = platform.Global;
	if (!Global) throw TypeError("async task registers require WebAssembly.Global");
	return new Global({
		value: "i32",
		mutable: !0
	}, 0);
};
const __jcoEmbeddedRuntime$TASK_INITIAL = "initial";
const __jcoEmbeddedRuntime$TASK_CANCEL_PENDING = "cancel-pending";
const __jcoEmbeddedRuntime$TASK_CANCEL_DELIVERED = "cancel-delivered";
const __jcoEmbeddedRuntime$TASK_RESOLVED = "resolved";
function __jcoEmbeddedRuntime$initializeAsyncTaskClass(context) {
	let { lookup: _lookup, registers: _registers, clearing: _clearing, RuntimeError: _RuntimeError, AsyncSubtask: _Subtask, Waitable: _Waitable, events: _events, determinism: _determinism, FutureValue, scopeCounter: _scopeCounter, scopeTasks: _scopeTasks, storeTrap: _storeTrap } = context;
	class AsyncTask {
		static _ID = 0n;
		static #hostThreadID = 0;
		static State = {
			INITIAL: __jcoEmbeddedRuntime$TASK_INITIAL,
			CANCELLED: "cancelled",
			CANCEL_PENDING: __jcoEmbeddedRuntime$TASK_CANCEL_PENDING,
			CANCEL_DELIVERED: __jcoEmbeddedRuntime$TASK_CANCEL_DELIVERED,
			RESOLVED: __jcoEmbeddedRuntime$TASK_RESOLVED
		};
		static BlockResult = {
			CANCELLED: "block.cancelled",
			NOT_CANCELLED: "block.not-cancelled"
		};
		#id;
		#componentIdx;
		#state;
		#isAsync;
		#isManualAsync;
		#callingWasmExport = !0;
		#lockFreeEntry = !1;
		#preserveFutureResult;
		#entryFnName;
		#onResolveHandlers = [];
		#progressWaiters = [];
		#completionPromise;
		#completionValue;
		#completionReady = !1;
		#settleCompletionPromise;
		#rejected = !1;
		#exitPromise;
		#resolveExitPromise;
		#memoryIdx = null;
		#memory = null;
		#callbackFn = null;
		#callbackFnName = null;
		#postReturnFn = null;
		#getCalleeParamsFn = null;
		#calleeIsAsync = null;
		#admissionTicket = null;
		#funcTypeIsAsync = !1;
		#returnResultTypeIdx = null;
		#parentSubtask = null;
		#errHandling;
		#returnLowerFns = null;
		#resourceScopeId;
		#resourceBorrowCount = 0;
		#resourceLenders = [];
		#resourceScopeExited = !1;
		#subtasks = [];
		#threads = [];
		#entered = !1;
		#exited = !1;
		#errored = null;
		get storage() {
			return this.defaultThread().storage;
		}
		cancelled = !1;
		cancelRequested = !1;
		alwaysTaskReturn = !1;
		returnCalls = 0;
		tmpRetI64HighBits = 0;
		constructor(opts) {
			this.#id = ++AsyncTask._ID;
			this.#resourceScopeId = ++_scopeCounter.value;
			_scopeTasks.set(this.#resourceScopeId, this);
			if (opts?.componentIdx === void 0) throw TypeError("missing component id during task creation");
			this.#componentIdx = opts.componentIdx;
			this.#state = __jcoEmbeddedRuntime$TASK_INITIAL;
			this.#isAsync = opts.isAsync ?? !1;
			this.#isManualAsync = opts.isManualAsync ?? !1;
			this.#preserveFutureResult = opts.preserveFutureResult ?? !1;
			this.#entryFnName = opts.entryFnName;
			this.#callingWasmExport = opts.callingWasmExport !== !1;
			let { promise: completionPromise, resolve: resolveCompletionPromise, reject: rejectCompletionPromise } = __jcoEmbeddedRuntime$promiseWithResolvers();
			this.#completionPromise = completionPromise;
			completionPromise.then(__jcoEmbeddedRuntime$emptyFunc, __jcoEmbeddedRuntime$emptyFunc);
			let completionSettled = !1;
			let settleCompletionPromise = () => {
				if (completionSettled || !this.#completionReady) return;
				completionSettled = !0;
				this.#errored === null ? this.#rejected ? rejectCompletionPromise(this.#completionValue) : this.#preserveFutureResult && this.#completionValue instanceof FutureValue ? this.#completionValue.resolveAsValue(resolveCompletionPromise) : resolveCompletionPromise(this.#completionValue) : rejectCompletionPromise(this.#errored);
			};
			this.#settleCompletionPromise = settleCompletionPromise;
			this.#onResolveHandlers.push((results) => {
				if (this.#parentSubtask !== null) return;
				if (!this.#isAsync && !this.#isManualAsync) return;
				this.#completionValue = results;
				this.#completionReady = !0;
			});
			let { promise: exitPromise, resolve: resolveExitPromise } = __jcoEmbeddedRuntime$promiseWithResolvers();
			this.#exitPromise = exitPromise;
			this.#resolveExitPromise = resolveExitPromise;
			opts.callbackFn && (this.#callbackFn = opts.callbackFn);
			opts.callbackFnName && (this.#callbackFnName = opts.callbackFnName);
			opts.getCalleeParamsFn && (this.#getCalleeParamsFn = opts.getCalleeParamsFn);
			opts.parentSubtask && (this.#parentSubtask = opts.parentSubtask);
			opts.errHandling && (this.#errHandling = opts.errHandling);
		}
		taskState() {
			return this.#state;
		}
		id() {
			return this.#id;
		}
		componentIdx() {
			return this.#componentIdx;
		}
		entryFnName() {
			return this.#entryFnName;
		}
		resourceScopeId() {
			return this.#resourceScopeId;
		}
		addBorrowedHandle() {
			if (this.#resourceScopeExited) throw Error("cannot add a borrow to an exited resource scope");
			this.#resourceBorrowCount++;
		}
		removeBorrowedHandle() {
			if (this.#resourceBorrowCount === 0) throw Error("resource borrow count underflow");
			this.#resourceBorrowCount--;
		}
		addResourceLender(table, handle) {
			if (this.#resourceScopeExited) throw Error("cannot add a lender to an exited resource scope");
			this.#resourceLenders.push({
				table,
				handle
			});
		}
		validateResourceBorrowScope() {
			if (this.#resourceScopeExited) return;
			if (_storeTrap.stopped) {
				this.#resourceLenders = [];
				this.#resourceScopeExited = !0;
				_scopeTasks.delete(this.#resourceScopeId);
				return;
			}
			if (this.#resourceBorrowCount !== 0) throw new _RuntimeError("borrow handles still remain at the end of the call");
			for (let { table, handle } of this.#resourceLenders) {
				let idx = handle << 1;
				let lendCount = table[idx];
				if (!Number.isInteger(lendCount) || lendCount <= 0 || lendCount >= 2 ** 30) throw Error("invalid resource lender state at scope exit");
				table[idx] = lendCount - 1;
			}
			this.#resourceLenders = [];
			this.#resourceScopeExited = !0;
			_scopeTasks.delete(this.#resourceScopeId);
		}
		completionPromise() {
			return this.#completionPromise;
		}
		settleCompletion() {
			this.#settleCompletionPromise();
		}
		exitPromise() {
			return this.#exitPromise;
		}
		waitForProgress() {
			let { promise, resolve } = __jcoEmbeddedRuntime$promiseWithResolvers();
			this.#progressWaiters.push(resolve);
			return promise;
		}
		notifyProgress() {
			let waiters = this.#progressWaiters;
			this.#progressWaiters = [];
			for (let resolve of waiters) resolve();
		}
		isAsync() {
			return this.#isAsync;
		}
		isManualAsync() {
			return this.#isManualAsync;
		}
		isSync() {
			return !this.isAsync();
		}
		getErrHandling() {
			return this.#errHandling;
		}
		hasCallback() {
			return this.#callbackFn !== null;
		}
		getReturnMemoryIdx() {
			return this.#memoryIdx;
		}
		setReturnMemoryIdx(idx) {
			if (idx === null) return;
			this.#memoryIdx = idx;
		}
		getReturnMemory() {
			return this.#memory;
		}
		setReturnMemory(m) {
			if (m === null) return;
			this.#memory = m;
		}
		setReturnLowerFns(fns) {
			this.#returnLowerFns = fns;
		}
		getReturnLowerFns() {
			return this.#returnLowerFns;
		}
		setCalleeIsAsync(value) {
			if (typeof value != "boolean") throw TypeError("callee async state must be a boolean");
			this.#calleeIsAsync = value;
		}
		setParentSubtask(subtask) {
			if (!subtask || !(subtask instanceof _Subtask)) return;
			if (this.#parentSubtask) throw Error("parent subtask can only be set once");
			this.#parentSubtask = subtask;
		}
		getParentSubtask() {
			return this.#parentSubtask;
		}
		getRootTask() {
			let currentSubtask = this.getParentSubtask();
			let task = this;
			for (; currentSubtask;) {
				task = currentSubtask.getParentTask();
				currentSubtask = task.getParentSubtask();
			}
			return task;
		}
		setPostReturnFn(f) {
			if (!f) return;
			if (this.#postReturnFn) throw Error("postReturn fn can only be set once");
			this.#postReturnFn = f;
		}
		setCallbackFn(f, name) {
			if (!f) return;
			if (this.#callbackFn) throw Error("callback fn can only be set once");
			this.#callbackFn = f;
			this.#callbackFnName = name;
		}
		getCallbackFnName() {
			if (!this.#callbackFnName) return;
			return this.#callbackFnName;
		}
		runCallbackFn(...args) {
			if (!this.#callbackFn) throw Error("no callback function has been set for task");
			if (this.#callbackFn._jcoMaySuspend === !1) return __jcoEmbeddedRuntime$withCurrentTaskMeta(_registers, {
				taskID: this.#id,
				threadID: this.defaultThread().id(),
				componentIdx: this.#componentIdx,
				fn: () => this.#callbackFn.apply(null, args)
			});
			return __jcoEmbeddedRuntime$withCurrentTaskMetaAsync(_registers, {
				taskID: this.#id,
				threadID: this.defaultThread().id(),
				componentIdx: this.#componentIdx,
				fn: () => this.#callbackFn.apply(null, args)
			});
		}
		getCalleeParams() {
			if (!this.#getCalleeParamsFn) throw Error("missing/invalid getCalleeParamsFn");
			return this.#getCalleeParamsFn();
		}
		mayBlock() {
			return this.isAsync() || this.isManualAsync() || this.isResolvedState() || this.#funcTypeIsAsync;
		}
		setFuncTypeIsAsync(v) {
			this.#funcTypeIsAsync = v;
		}
		setReturnResultTypeIdx(v) {
			this.#returnResultTypeIdx = v;
		}
		returnResultTypeIdx() {
			return this.#returnResultTypeIdx;
		}
		mayEnter(task) {
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			if (cstate.hasBackpressure()) {
				__jcoEmbeddedRuntime$debugLog("[AsyncTask#mayEnter()] disallowed due to backpressure", { taskID: this.#id });
				return !1;
			}
			if (!cstate.callingSyncImport()) {
				__jcoEmbeddedRuntime$debugLog("[AsyncTask#mayEnter()] disallowed due to sync import call", { taskID: this.#id });
				return !1;
			}
			if (!Reflect.get(cstate, "callingSyncExport") || task.isAsync) {
				__jcoEmbeddedRuntime$debugLog("[AsyncTask#mayEnter()] disallowed due to sync export w/ sync pending", { taskID: this.#id });
				return !1;
			}
			return !0;
		}
		enterSync() {
			if (this.needsExclusiveLock()) {
				let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
				if (!cstate.isExclusivelyLocked()) cstate.exclusiveLock(this.#id);
				else {
					this.#lockFreeEntry = !0;
					__jcoEmbeddedRuntime$debugLog("[AsyncTask#enterSync()] entering without exclusive lock", {
						taskID: this.#id,
						componentIdx: this.#componentIdx
					});
				}
			}
			return !0;
		}
		tryEnter() {
			if (this.#entered) throw Error(`task with ID [${this.#id}] should not be entered twice`);
			if (this.deliverPendingCancel({ cancellable: !0 })) {
				this.cancel();
				return !1;
			}
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			if (this.isSync()) {
				this.#entered = !0;
				return !0;
			}
			if (cstate.hasBackpressure()) return null;
			if (cstate.hasPendingAdmissions()) return null;
			if (this.needsExclusiveLock()) {
				if (cstate.isExclusivelyLocked()) return null;
				cstate.exclusiveLock(this.#id);
			}
			if (this.deliverPendingCancel({ cancellable: !0 })) {
				cstate.exclusiveRelease(this.#id);
				this.cancel();
				return !1;
			}
			this.#entered = !0;
			return !0;
		}
		async enter(opts) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#enter()] args", {
				taskID: this.#id,
				componentIdx: this.#componentIdx,
				subtaskID: this.getParentSubtask()?.id(),
				args: opts,
				entryFnName: this.#entryFnName
			});
			if (opts?.isHost) return this.enterHost();
			if (this.#entered) throw Error(`task with ID [${this.#id}] should not be entered twice`);
			if (this.deliverPendingCancel({ cancellable: !0 })) {
				this.cancel();
				return !1;
			}
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			if (this.isSync()) {
				this.#entered = !0;
				this.#isManualAsync && this.needsExclusiveLock() && await cstate.acquireExclusiveLock(this.#id);
				return this.#entered;
			}
			let ticket = cstate.takeAdmissionTicket(this.#id);
			this.#admissionTicket = ticket;
			let entered = !1;
			try {
				entered = await this.#enterQueued(cstate, ticket);
				return entered;
			} finally {
				entered || this.endFirstSlice();
			}
		}
		endFirstSlice() {
			let ticket = this.#admissionTicket;
			if (ticket === null) return;
			this.#admissionTicket = null;
			__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx).releaseAdmissionTicket(ticket);
		}
		async #enterQueued(cstate, ticket) {
			await cstate.waitForAdmissionTurn(ticket);
			if (this.isResolvedState() || this.isCancelled()) return !1;
			for (;;) {
				if (cstate.hasBackpressure()) {
					cstate.addBackpressureWaiter();
					let result = await this.waitUntil({
						readyFn: () => !cstate.hasBackpressure(),
						cancellable: !0
					});
					cstate.removeBackpressureWaiter();
					if (!result || this.isCancelled()) {
						this.isResolvedState() || this.cancel();
						return !1;
					}
				}
				if (this.needsExclusiveLock()) {
					await cstate.acquireExclusiveLock(this.#id);
					if (cstate.hasBackpressure()) {
						cstate.exclusiveRelease(this.#id);
						continue;
					}
				}
				break;
			}
			try {
				cstate.throwIfInterrupted();
			} catch (err) {
				cstate.exclusiveRelease(this.#id);
				this.setErrored(err);
				return !1;
			}
			if (this.isResolvedState() || this.isCancelled()) {
				cstate.exclusiveRelease(this.#id);
				return !1;
			}
			if (this.deliverPendingCancel({ cancellable: !0 })) {
				cstate.exclusiveRelease(this.#id);
				this.cancel();
				return !1;
			}
			this.#entered = !0;
			return this.#entered;
		}
		isRunningState() {
			return this.#state !== __jcoEmbeddedRuntime$TASK_RESOLVED;
		}
		isResolvedState() {
			return this.#state === __jcoEmbeddedRuntime$TASK_RESOLVED;
		}
		isResolved() {
			return this.#state === __jcoEmbeddedRuntime$TASK_RESOLVED;
		}
		isExited() {
			return this.#exited;
		}
		async waitUntil(opts) {
			let { readyFn, cancellable } = opts;
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#waitUntil()] args", {
				taskID: this.#id,
				args: { cancellable }
			});
			return await this.suspendUntil({
				readyFn,
				cancellable
			});
		}
		async yieldUntil(opts) {
			let { readyFn, cancellable } = opts;
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#yieldUntil()]", {
				taskID: this.#id,
				args: { cancellable },
				componentIdx: this.#componentIdx
			});
			return {
				code: await this.immediateSuspend({
					readyFn,
					cancellable
				}) ? _events.NONE : _events.TASK_CANCELLED,
				payload0: 0,
				payload1: 0
			};
		}
		async suspendUntil(opts) {
			let { cancellable, readyFn } = opts;
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#suspendUntil()] args", {
				taskID: this.#id,
				args: { cancellable },
				componentIdx: this.#componentIdx
			});
			if (this.deliverPendingCancel({ cancellable })) return !1;
			return await this.immediateSuspendUntil({
				readyFn,
				cancellable
			});
		}
		suspendUntilCallback(opts, onResume) {
			let { cancellable, readyFn } = opts;
			if (this.deliverPendingCancel({ cancellable })) {
				onResume(!1);
				return;
			}
			__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx).suspendTask({
				task: this,
				cancellable: !!cancellable,
				readyFn: () => {
					if (cancellable && this.#state === __jcoEmbeddedRuntime$TASK_CANCEL_PENDING) return !0;
					return readyFn();
				},
				onResume: (keepGoing) => {
					keepGoing && this.deliverPendingCancel({ cancellable }) && (keepGoing = !1);
					onResume(keepGoing);
				}
			});
		}
		async immediateSuspendUntil(opts) {
			let { cancellable, readyFn } = opts;
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#immediateSuspendUntil()] args", {
				args: {
					cancellable,
					readyFn
				},
				taskID: this.#id,
				componentIdx: this.#componentIdx
			});
			if (readyFn() && _determinism === "random" && __jcoEmbeddedRuntime$coinFlip()) return !0;
			return await this.immediateSuspend({
				cancellable,
				readyFn
			});
		}
		async immediateSuspend(opts) {
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			let thread = this.#entered ? cstate.threads.get(__jcoEmbeddedRuntime$getCurrentTaskMeta(_registers, this.#componentIdx).threadID) : this.defaultThread();
			if (!thread || thread.task() !== this) throw Error("invalid current thread for wait");
			return thread.suspend({
				...opts,
				releaseLock: !1
			});
		}
		deliverPendingCancel(opts) {
			let { cancellable } = opts;
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#deliverPendingCancel()]", {
				args: { cancellable },
				taskID: this.#id,
				componentIdx: this.#componentIdx
			});
			if (cancellable && this.#state === __jcoEmbeddedRuntime$TASK_CANCEL_PENDING) {
				this.#state = __jcoEmbeddedRuntime$TASK_CANCEL_DELIVERED;
				return !0;
			}
			return !1;
		}
		isCancelled() {
			return this.cancelled;
		}
		cancellationRequested() {
			return this.cancelRequested;
		}
		requestCancellation() {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#requestCancellation()] args", {
				taskID: this.#id,
				componentIdx: this.#componentIdx,
				state: this.#state
			});
			if (this.isResolvedState() || this.cancelRequested) return;
			this.cancelRequested = !0;
			if (this.#state === __jcoEmbeddedRuntime$TASK_INITIAL) {
				this.#state = __jcoEmbeddedRuntime$TASK_CANCEL_PENDING;
				if (!this.#entered) {
					this.deliverPendingCancel({ cancellable: !0 });
					this.cancel();
					let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
					cstate.resumeTaskByID(this.#id);
					cstate.cancelExclusiveLockWaiter(this.#id);
					this.exit({ skipExclusiveLockCheck: !0 });
					return;
				}
			}
			__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx).runTickLoop();
		}
		cancel(args) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#cancel()] args", {});
			if (this.taskState() !== __jcoEmbeddedRuntime$TASK_CANCEL_DELIVERED) throw Error("`task.cancel` called by task which has not been cancelled");
			this.validateResourceBorrowScope();
			this.cancelled = !0;
			this.onResolve(args?.error ?? null);
			this.#state = __jcoEmbeddedRuntime$TASK_RESOLVED;
			this.#entered || this.notifyProgress();
		}
		onResolve(taskValue) {
			let handlers = this.#onResolveHandlers;
			this.#onResolveHandlers = [];
			for (let f of handlers) try {
				f(taskValue);
			} catch (err) {
				__jcoEmbeddedRuntime$debugLog("[AsyncTask#onResolve] error during task resolve handler", err);
				throw err;
			}
			if (this.#rejected) {
				this.#parentSubtask?.reject(taskValue);
				return;
			}
			let parentSubtaskPending = this.#parentSubtask && !this.#parentSubtask.isResolved();
			let taskReturned = !this.isCancelled();
			if (parentSubtaskPending && taskReturned) {
				let meta = this.#parentSubtask.getCallMetadata();
				if (meta.returnFn && !meta.returnFnCalled) {
					__jcoEmbeddedRuntime$debugLog("[AsyncTask#onResolve()] running returnFn", {
						componentIdx: this.#componentIdx,
						taskID: this.#id,
						subtaskID: this.#parentSubtask.id()
					});
					let callerTask = this.#parentSubtask.getParentTask();
					__jcoEmbeddedRuntime$withCurrentTaskMeta(_registers, {
						taskID: callerTask.id(),
						threadID: meta.callerThreadID,
						componentIdx: callerTask.componentIdx(),
						fn: () => meta.returnFn.apply(null, [taskValue, meta.resultPtr])
					});
					meta.returnFnCalled = !0;
				}
			}
			if (this.#postReturnFn && taskReturned) {
				__jcoEmbeddedRuntime$debugLog("[AsyncTask#onResolve()] running post return ", {
					componentIdx: this.#componentIdx,
					taskID: this.#id
				});
				try {
					__jcoEmbeddedRuntime$withCurrentTaskMeta(_registers, {
						taskID: this.#id,
						threadID: this.defaultThread().id(),
						componentIdx: this.#componentIdx,
						fn: () => this.#postReturnFn(taskValue)
					});
				} catch (err) {
					err = __jcoEmbeddedRuntime$postReturnTrap(context.postReturn, this.#componentIdx, err);
					this.reject(err);
					throw err;
				}
			}
			parentSubtaskPending && this.#parentSubtask.onResolve(taskValue);
		}
		registerOnResolveHandler(f) {
			this.#onResolveHandlers.push(f);
		}
		isRejected() {
			return this.#rejected;
		}
		isErrored() {
			return this.#errored;
		}
		setErrored(err) {
			this.#errored === null && (this.#errored = err);
		}
		stop(err) {
			this.reject(err);
			this.#completionReady = !0;
			this.#settleCompletionPromise();
		}
		reject(taskErr) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#reject()] args", {
				componentIdx: this.#componentIdx,
				taskID: this.#id,
				parentSubtask: this.#parentSubtask,
				parentSubtaskID: this.#parentSubtask?.id(),
				entryFnName: this.entryFnName(),
				callbackFnName: this.#callbackFnName,
				errMsg: taskErr.message
			});
			this.setErrored(taskErr);
			if (this.#rejected) return;
			if (this.isResolvedState()) {
				this.#rejected = !0;
				this.#errored = taskErr;
				let parentTask = this.#parentSubtask?.getParentTask();
				parentTask && parentTask.reject(taskErr);
				return;
			}
			this.#rejected = !0;
			this.cancelRequested = !0;
			this.#state = __jcoEmbeddedRuntime$TASK_CANCEL_PENDING;
			this.deliverPendingCancel({ cancellable: !0 });
			this.cancel({ error: taskErr });
		}
		resolve(results) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#resolve()] args", {
				componentIdx: this.#componentIdx,
				taskID: this.#id,
				entryFnName: this.entryFnName(),
				callbackFnName: this.#callbackFnName
			});
			if (this.#state === __jcoEmbeddedRuntime$TASK_RESOLVED) {
				if (this.#errored !== null) throw this.#errored;
				throw Error(`(component [${this.#componentIdx}]) task [${this.#id}]  is already resolved (did you forget to wait for an import?)`);
			}
			this.validateResourceBorrowScope();
			this.#state = __jcoEmbeddedRuntime$TASK_RESOLVED;
			switch (results.length) {
				case 0:
					this.onResolve(void 0);
					break;
				case 1:
					this.onResolve(results[0]);
					break;
				default:
					__jcoEmbeddedRuntime$debugLog("[AsyncTask#resolve()] unexpected number of results", {
						componentIdx: this.#componentIdx,
						results,
						taskID: this.#id,
						subtaskID: this.#parentSubtask?.id(),
						entryFnName: this.#entryFnName,
						callbackFnName: this.#callbackFnName
					});
					throw Error("unexpected number of results");
			}
		}
		exit(args) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#exit()]", {
				componentIdx: this.#componentIdx,
				taskID: this.#id
			});
			this.endFirstSlice();
			if (this.#exited) throw Error("task has already exited");
			this.#checkThreadExit();
			this.validateResourceBorrowScope();
			let state = this.#componentIdx === -1 ? null : __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			if (!state && this.#componentIdx !== -1) throw Error("missing async state for component [" + this.#componentIdx + "]");
			if (state && !args?.skipExclusiveLockCheck && !this.#lockFreeEntry && this.needsExclusiveLock() && !state.exclusivelyLockedBy(this.#id)) throw Error(`task [${this.#id}] exit: component [${this.#componentIdx}] should have been exclusively locked by it`);
			state && state.exclusiveRelease(this.#id);
			this.notifyProgress();
			try {
				this.#parentSubtask === null && (this.#isAsync || this.#isManualAsync) && this.#settleCompletionPromise();
				this.#resolveExitPromise();
			} catch (err) {
				console.error("error during task exit handler", err);
				throw err;
			}
			this.#exited = !0;
			this.removeThread(this.defaultThread());
			this.#threads.length > 0 && __jcoEmbeddedRuntime$clearCurrentThread(_clearing, this.#componentIdx, this.#id, { preserveTask: !0 });
		}
		needsExclusiveLock() {
			if (this.#componentIdx === -1) return !1;
			if (!this.#callingWasmExport) return !1;
			if (!this.#funcTypeIsAsync) return !1;
			return !this.#isAsync || this.hasCallback() || this.#calleeIsAsync === !1;
		}
		createSubtask(args) {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#createSubtask()] args", args);
			let { componentIdx, childTask, callMetadata, fnName, isAsync, isManualAsync } = args;
			if (!__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx)) throw Error(`invalid/missing async state for component idx [${componentIdx}]`);
			let waitable = new _Waitable({
				componentIdx: this.#componentIdx,
				target: `subtask (internal ID [${this.#id}])`
			});
			let newSubtask = new _Subtask({
				componentIdx,
				childTask,
				parentTask: this,
				callMetadata,
				isAsync,
				isManualAsync,
				fnName,
				waitable
			});
			this.#subtasks.push(newSubtask);
			newSubtask.setTarget(`subtask (internal ID [${newSubtask.id()}], waitable [${waitable.idx()}], component [${componentIdx}])`);
			return newSubtask;
		}
		getLatestSubtask() {
			return this.#subtasks.at(-1);
		}
		getSubtaskByWaitableRep(rep) {
			if (rep === void 0) throw TypeError("missing rep");
			return this.#subtasks.find((s) => s.waitableRep() === rep);
		}
		currentSubtask() {
			__jcoEmbeddedRuntime$debugLog("[AsyncTask#currentSubtask()]");
			if (this.#subtasks.length === 0) return;
			return this.#subtasks.at(-1);
		}
		removeSubtask(subtask) {
			if (this.#subtasks.length === 0) throw Error("cannot end current subtask: no current subtask");
			this.#subtasks = this.#subtasks.filter((t) => t !== subtask);
			return subtask;
		}
		cancellationPending() {
			return this.#state === __jcoEmbeddedRuntime$TASK_CANCEL_PENDING;
		}
		enterHost() {
			if (this.#entered) throw Error(`task with ID [${this.#id}] should not be entered twice`);
			if (this.deliverPendingCancel({ cancellable: !0 })) {
				this.cancel();
				return !1;
			}
			__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			this.#entered = !0;
			let parentTask = this.#parentSubtask?.getParentTask();
			(parentTask?.taskState() === __jcoEmbeddedRuntime$TASK_CANCEL_DELIVERED || parentTask && !parentTask.hasCallback()) && parentTask.notifyProgress();
			return this.#entered;
		}
		defaultThread() {
			return this.#threads[0];
		}
		removeThread(thread) {
			this.#checkThreadExit();
			this.settleCompletion();
			this.#componentIdx !== -1 && __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx).threads.remove(thread.id());
			this.#threads = this.#threads.filter((t) => t !== thread);
			this.#exited && this.#threads.length === 0 && __jcoEmbeddedRuntime$clearCurrentThread(_clearing, this.#componentIdx, this.#id);
		}
		#checkThreadExit() {
			if (this.#threads.length === 1 && !this.isResolvedState() && !this.isRejected()) {
				let err = new _RuntimeError(`(component [${this.#componentIdx}]) task [${this.#id}] exited without resolution`);
				throw this.#componentIdx === -1 ? err : __jcoEmbeddedRuntime$recordTrap(context.traps, this.#componentIdx, err);
			}
		}
		addThread(thread) {
			if (this.#componentIdx === -1) {
				thread.setId(++AsyncTask.#hostThreadID);
				this.#threads.push(thread);
				return thread;
			}
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			thread.setId(cstate.threads.insert(thread));
			this.#threads.push(thread);
			return thread;
		}
		calleeIsAsync() {
			return this.#calleeIsAsync === !0;
		}
	}
	return AsyncTask;
}
function __jcoEmbeddedRuntime$initializeAsyncSubtaskClass(context) {
	let { lookup: _lookup, memories: _memories, disposeSymbol: _disposeSymbol, RuntimeError } = context;
	class AsyncSubtask {
		static _ID = 0n;
		static State = {
			STARTING: 0,
			STARTED: 1,
			RETURNED: 2,
			CANCELLED_BEFORE_STARTED: 3,
			CANCELLED_BEFORE_RETURNED: 4
		};
		#id;
		#state = 0;
		#componentIdx;
		#parentTask;
		#childTask = null;
		#cancelRequested = !1;
		#lenders = null;
		#waitable;
		#callbackFn = null;
		#postReturnFn = null;
		#onProgressFn = null;
		#callMetadata = {};
		#resolved = !1;
		#onResolveHandlers = [];
		#onStartHandlers = [];
		#result = null;
		#resultSet = !1;
		#hostPendingResult = null;
		fnName;
		target;
		isAsync;
		isManualAsync;
		cancelProgress = null;
		constructor(args) {
			if (typeof args.componentIdx != "number") throw Error("invalid componentIdx for subtask creation");
			this.#componentIdx = args.componentIdx;
			this.#id = ++AsyncSubtask._ID;
			this.fnName = args.fnName;
			if (!args.parentTask) throw Error("missing parent task during subtask creation");
			this.#parentTask = args.parentTask;
			args.childTask && (this.#childTask = args.childTask);
			if (!args.waitable) throw Error("missing/invalid waitable");
			this.#waitable = args.waitable;
			args.callMetadata && (this.#callMetadata = args.callMetadata);
			this.#lenders = [];
			this.target = args.target;
			this.isAsync = args.isAsync;
			this.isManualAsync = args.isManualAsync;
		}
		id() {
			return this.#id;
		}
		parentTaskID() {
			return this.#parentTask?.id();
		}
		childTaskID() {
			return this.#childTask?.id();
		}
		state() {
			return this.#state;
		}
		getWaitable() {
			return this.#waitable;
		}
		waitable() {
			return this.#waitable;
		}
		waitableRep() {
			return this.#waitable.idx();
		}
		ensureHandle() {
			let existing = this.#waitable.idx();
			if (existing != null) return existing;
			let idx = this.#getComponentState().handles.insert(this);
			this.#waitable.setIdx(idx);
			this.#waitable.setTarget(`waitable for subtask (waitable id [${idx}], subtask internal ID [${this.id()}])`);
			return idx;
		}
		join(set) {
			return this.#waitable.join(set);
		}
		getPendingEvent() {
			return this.#waitable.getPendingEvent();
		}
		hasPendingEvent() {
			return this.#waitable.hasPendingEvent();
		}
		setPendingEvent(fn) {
			return this.#waitable.setPendingEvent(fn);
		}
		setTarget(tgt) {
			this.target = tgt;
		}
		getResult() {
			if (!this.#resultSet) throw Error("subtask result has not been set");
			return this.#result;
		}
		setResult(v) {
			if (this.#resultSet) throw Error("subtask result has already been set");
			this.#result = v;
			this.#resultSet = !0;
		}
		componentIdx() {
			return this.#componentIdx;
		}
		setChildTask(t) {
			if (!t) throw Error("cannot set missing/invalid child task on subtask");
			if (this.#childTask) throw Error("child task is already set on subtask");
			if (this.#parentTask === t) throw Error("parent cannot be child");
			this.#childTask = t;
		}
		getChildTask() {
			return this.#childTask;
		}
		getParentTask() {
			return this.#parentTask;
		}
		setCallbackFn(f, _name) {
			if (!f) return;
			if (this.#callbackFn) throw Error("callback fn can only be set once");
			this.#callbackFn = f;
		}
		getCallbackFnName() {
			return this.#callbackFn?.name;
		}
		setPostReturnFn(f) {
			if (!f) return;
			if (this.#postReturnFn) throw Error("postReturn fn can only be set once");
			this.#postReturnFn = f;
		}
		setOnProgressFn(f) {
			if (this.#onProgressFn) throw Error("on progress fn can only be set once");
			this.#onProgressFn = f;
		}
		isNotStarted() {
			return this.#state == 0;
		}
		cancellationRequested() {
			return this.#cancelRequested;
		}
		requestCancellation() {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#requestCancellation()] args", {
				componentIdx: this.#componentIdx,
				subtaskID: this.#id,
				state: this.#state,
				childTaskID: this.childTaskID(),
				fnName: this.fnName
			});
			if (this.#cancelRequested) throw Error("cancellation has already been requested for this subtask");
			this.#cancelRequested = !0;
			if (this.#resolved) return;
			if (this.#childTask) {
				this.#childTask.requestCancellation();
				return;
			}
			this.onResolve(null);
			this.#disposeHostPendingResult();
		}
		setHostPendingResult(v) {
			if (!__jcoEmbeddedRuntime$isPromiseLike(v)) return;
			this.#hostPendingResult = v;
			this.#resolved && this.#state !== 2 && this.#disposeHostPendingResult();
		}
		#disposeHostPendingResult() {
			let pending = this.#hostPendingResult;
			if (!pending) return;
			this.#hostPendingResult = null;
			__jcoEmbeddedRuntime$disposeHostValue(_disposeSymbol, pending);
		}
		registerOnStartHandler(f) {
			this.#onStartHandlers.push(f);
		}
		onStart(args) {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#onStart()] args", {
				componentIdx: this.#componentIdx,
				subtaskID: this.#id,
				parentTaskID: this.parentTaskID(),
				fnName: this.fnName,
				args
			});
			this.#onProgressFn?.();
			this.#parentTask.notifyProgress();
			this.#state = 1;
			let result;
			this.#callMetadata.startFn && (result = this.#callMetadata.startFn.apply(null, args?.startFnParams ?? []));
			return result;
		}
		registerOnResolveHandler(f) {
			this.#onResolveHandlers.push(f);
		}
		reject(subtaskErr) {
			if (this.#resolved) return;
			this.#onProgressFn?.();
			if (this.#state >= 2) throw Error("cannot reject a completed subtask");
			this.#state = this.#state === 0 ? 3 : 4;
			this.#resolved = !0;
			this.#hostPendingResult = null;
			this.#parentTask.removeSubtask(this);
			this.#parentTask.reject(subtaskErr);
		}
		onResolve(subtaskValue) {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#onResolve()] args", {
				componentIdx: this.#componentIdx,
				subtaskID: this.#id,
				isAsync: this.isAsync,
				childTaskID: this.childTaskID(),
				parentTaskID: this.parentTaskID(),
				parentTaskFnName: this.#parentTask?.entryFnName(),
				fnName: this.fnName
			});
			if (this.#resolved) throw Error("subtask has already been resolved");
			this.#onProgressFn?.();
			if (subtaskValue === null && this.#cancelRequested) {
				if (this.#state >= 2) throw Error("resolved subtask must have been started before cancellation");
				this.#state = this.#state === 0 ? 3 : 4;
			} else {
				if (this.#state !== 1) throw Error("resolved subtask must have been started before completion");
				this.#state = 2;
				this.#hostPendingResult = null;
			}
			this.setResult(subtaskValue);
			for (let f of this.#onResolveHandlers) try {
				f(subtaskValue);
			} catch (err) {
				console.error("error during subtask resolve handler", err);
				throw err;
			}
			let callMetadata = this.getCallMetadata();
			let memory = callMetadata.memory ?? this.#parentTask?.getReturnMemory() ?? __jcoEmbeddedRuntime$lookupMemories(_memories, { componentIdx: this.#parentTask.componentIdx() })[0]?.memory;
			if (this.#state === 2 && callMetadata && !callMetadata.returnFn && (this.isAsync || callMetadata.funcTypeIsAsync) && callMetadata.resultPtr && memory) {
				let { resultPtr, realloc } = callMetadata;
				let lowers = callMetadata.lowers;
				lowers && lowers.length > 0 && lowers[0]({
					componentIdx: this.#componentIdx,
					memory,
					realloc,
					vals: [subtaskValue],
					storagePtr: resultPtr,
					stringEncoding: callMetadata.stringEncoding
				});
			}
			this.#resolved = !0;
			this.#parentTask.removeSubtask(this);
			if (!this.isAsync) {
				this.deliverResolve();
				let rep = this.waitableRep();
				if (rep) try {
					if (this.#getComponentState().handles.remove(rep) !== this) throw Error("unexpectedly received non-self Subtask from handle removal");
					this.drop();
				} catch (err) {
					__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#onResolve()] failed to remove subtask after sync subtask completion", err);
				}
			}
		}
		getStateNumber() {
			return this.#state;
		}
		isReturned() {
			return this.#state === 2;
		}
		getCallMetadata() {
			return this.#callMetadata;
		}
		isResolved() {
			return this.#state >= 2;
		}
		addLender(handle) {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#addLender()] args", { handle });
			if (!handle || typeof handle.lends != "number") throw Error("missing/invalid lender handle [" + handle + "]");
			if (this.#lenders === null || this.isResolved()) throw Error("subtask has no lendors or has already been resolved");
			handle.lends++;
			this.#lenders.push(handle);
		}
		deliverResolve() {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#deliverResolve()] args", {
				lenders: this.#lenders,
				parentTaskID: this.parentTaskID(),
				subtaskID: this.#id,
				childTaskID: this.childTaskID(),
				resolved: this.isResolved(),
				resolveDelivered: this.resolveDelivered()
			});
			if (this.resolveDelivered() || !this.isResolved()) throw Error("subtask cannot deliver resolution twice, and the subtask must be resolved");
			for (let lender of this.#lenders) lender.lends--;
			this.#lenders = null;
		}
		resolveDelivered() {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#resolveDelivered()] args", {});
			if (this.#lenders === null && !this.isResolved()) throw Error("invalid subtask state, lenders missing and subtask has not been resolved");
			return this.#lenders === null;
		}
		drop() {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#drop()] args", {
				componentIdx: this.#componentIdx,
				parentTaskID: this.#parentTask?.id(),
				parentTaskFnName: this.#parentTask?.entryFnName(),
				childTaskID: this.#childTask?.id(),
				childTaskFnName: this.#childTask?.entryFnName(),
				subtaskFnName: this.fnName
			});
			if (!this.#waitable) throw Error("missing/invalid inner waitable");
			if (!this.resolveDelivered()) throw new RuntimeError("cannot drop a subtask which has not yet resolved");
			this.#waitable && this.#waitable.drop();
		}
		#getComponentState() {
			let state = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			if (!state) throw Error("invalid/missing async state for component [" + this.#componentIdx + "]");
			return state;
		}
		getWaitableHandleIdx() {
			__jcoEmbeddedRuntime$debugLog("[AsyncSubtask#getWaitableHandleIdx()] args", {});
			if (!this.#waitable) throw Error("missing/invalid waitable");
			return this.waitableRep();
		}
	}
	return AsyncSubtask;
}
function __jcoEmbeddedRuntime$lowerImportBackwardsCompat(_context, args, ...params) {
	__jcoEmbeddedRuntime$debugLog("[_lowerImportBackwardsCompat()] args", {
		args,
		params
	});
	let { componentIdx, isAsync, isManualAsync, resultLowerFns, hasResultPointer, funcTypeIsAsync, memoryIdx, getMemoryFn, getReallocFn, importFn, stringEncoding } = args;
	__jcoEmbeddedRuntime$checkMayLeave(_context.mayLeave, componentIdx);
	let meta = __jcoEmbeddedRuntime$getCurrentTaskMeta(_context.registers, componentIdx);
	let taskMeta = meta && __jcoEmbeddedRuntime$getCurrentTask(_context, componentIdx, meta.taskID);
	let createdTask;
	if (!taskMeta) {
		if (funcTypeIsAsync || isAsync && !isManualAsync) throw Error("p3 async wasm exports cannot use backwards compat auto-task init");
		let { task: newTask, taskID: newTaskID, threadID: newThreadID } = __jcoEmbeddedRuntime$createNewCurrentImplicitThread(_context.creation, {
			componentIdx,
			isAsync,
			isManualAsync,
			callingWasmExport: !1
		});
		createdTask = newTask;
		createdTask.registerOnResolveHandler(() => {
			__jcoEmbeddedRuntime$clearCurrentTaskMeta(_context.registers, {
				taskID: newTaskID,
				threadID: newThreadID,
				componentIdx: task.componentIdx()
			});
		});
		__jcoEmbeddedRuntime$setCurrentTaskMeta(_context.registers, {
			componentIdx,
			taskID: newTaskID,
			threadID: newThreadID
		});
		taskMeta = __jcoEmbeddedRuntime$getCurrentTask(_context, componentIdx, newTaskID);
	}
	if (!taskMeta) throw Error("invalid/missing async task meta");
	let task = taskMeta.task;
	if (!task) throw Error("invalid/missing async task");
	__jcoEmbeddedRuntime$getOrCreateAsyncState(_context.lookup, componentIdx);
	if (!task.mayBlock() && funcTypeIsAsync && !isAsync) throw Error("non async exports cannot synchronously call async functions");
	let memory = getMemoryFn();
	let resultPtr = hasResultPointer ? params[params.length - 1] >>> 0 : void 0;
	let subtask = task.createSubtask({
		componentIdx,
		parentTask: task,
		fnName: importFn.fnName,
		isAsync,
		isManualAsync,
		callMetadata: {
			memoryIdx,
			memory,
			realloc: getReallocFn?.(),
			getReallocFn,
			resultPtr,
			lowers: resultLowerFns,
			funcTypeIsAsync,
			stringEncoding
		}
	});
	task.setReturnMemoryIdx(memoryIdx);
	task.setReturnMemory(getMemoryFn());
	subtask.onStart();
	if (!isManualAsync && !isAsync && !funcTypeIsAsync) {
		createdTask && createdTask.enterSync();
		importFn(...params);
		if (!funcTypeIsAsync && !subtask.isReturned()) throw Error("post-execution subtasks must either be async or returned");
		let syncRes = subtask.getResult();
		if (createdTask) {
			createdTask.resolve([syncRes]);
			createdTask.exit();
		}
		return syncRes;
	}
	if (!isManualAsync && !isAsync && funcTypeIsAsync) {
		let { promise, resolve, reject } = __jcoEmbeddedRuntime$promiseWithResolvers();
		queueMicrotask(async () => {
			try {
				await importFn(...params);
				subtask.isResolved() || await task.suspendUntil({ readyFn: () => subtask.isResolved() });
				resolve(subtask.getResult());
			} catch (err) {
				reject(err);
			}
		});
		return promise;
	}
	let subtaskState = subtask.getStateNumber();
	if (subtaskState < 0 || subtaskState >= 16) throw Error("invalid subtask state, out of valid range");
	subtask.setOnProgressFn(() => {
		subtask.setPendingEvent(() => {
			subtask.isResolved() && subtask.deliverResolve();
			return {
				code: _context.events.SUBTASK,
				payload0: subtask.waitableRep(),
				payload1: subtask.getStateNumber()
			};
		});
	});
	if (!isAsync && !funcTypeIsAsync && isManualAsync) {
		__jcoEmbeddedRuntime$debugLog("[_lowerImportBackwardsCompat()] calling lowered import", {
			importFn,
			params
		});
		createdTask && createdTask.enterSync();
		try {
			let result = importFn(...params);
			let isPromise = __jcoEmbeddedRuntime$isPromiseLike(result);
			createdTask && createdTask.resolve([isPromise ? void 0 : result]);
			if (!isPromise) return subtask.getResult();
			return Promise.resolve(result).then(() => subtask.getResult());
		} catch (error) {
			createdTask && createdTask.reject(error);
			throw error;
		} finally {
			createdTask && createdTask.exit();
		}
	}
	queueMicrotask(async () => {
		try {
			__jcoEmbeddedRuntime$debugLog("[_lowerImportBackwardsCompat()] calling lowered import", {
				importFn,
				params
			});
			createdTask && await createdTask.enter();
			let asyncRes = await importFn(...params);
			createdTask && createdTask.resolve([asyncRes]);
		} catch (err) {
			__jcoEmbeddedRuntime$debugLog("[_lowerImportBackwardsCompat()] import fn error:", err);
			task.setErrored(err);
			task.reject(err);
		}
	});
	__jcoEmbeddedRuntime$debugLog("[_lowerImportBackwardsCompat()] async-lowered import return", {
		fnName: importFn.fnName,
		componentIdx,
		subtaskID: subtask.id(),
		waitableRep: subtask.waitableRep(),
		subtaskState,
		packedResult: Number(subtask.waitableRep()) << 4 | subtaskState
	});
	return Number(subtask.ensureHandle()) << 4 | subtaskState;
}
const __jcoEmbeddedRuntime$THREAD_NOT_STARTED = "not-started";
const __jcoEmbeddedRuntime$THREAD_RUNNING = "running";
const __jcoEmbeddedRuntime$THREAD_COMPLETED = "completed";
function __jcoEmbeddedRuntime$initializeAsyncThreadClass(context) {
	let { lookup: _lookup, registers: _registers } = context;
	class AsyncThread {
		static State = {
			NOT_STARTED: __jcoEmbeddedRuntime$THREAD_NOT_STARTED,
			RUNNING: __jcoEmbeddedRuntime$THREAD_RUNNING,
			COMPLETED: __jcoEmbeddedRuntime$THREAD_COMPLETED
		};
		#id = null;
		#componentIdx;
		#task;
		#state;
		#startFn = null;
		storage = [0, 0];
		constructor(opts) {
			if (opts?.componentIdx === void 0) throw TypeError("missing component id during thread creation");
			this.#componentIdx = opts.componentIdx;
			if (!opts?.task) throw TypeError("missing task during thread creation");
			this.#task = opts.task;
			if (opts.startFn) {
				this.#startFn = opts.startFn;
				this.#state = __jcoEmbeddedRuntime$THREAD_NOT_STARTED;
			} else this.#state = __jcoEmbeddedRuntime$THREAD_RUNNING;
		}
		id() {
			return this.#id;
		}
		setId(id) {
			if (this.#id !== null) throw Error("thread id can only be assigned once");
			this.#id = id;
		}
		componentIdx() {
			return this.#componentIdx;
		}
		task() {
			return this.#task;
		}
		taskID() {
			return this.#task.id();
		}
		state() {
			return this.#state;
		}
		isCancelled() {
			return this.#task.isCancelled();
		}
		isRejected() {
			return this.#task.isRejected();
		}
		notifyProgress() {
			return this.#task.notifyProgress();
		}
		entryFnName() {
			return this.#task.entryFnName();
		}
		getParentSubtask() {
			return this.#task.getParentSubtask();
		}
		async suspend(opts) {
			let cstate = __jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx);
			let task = this.#task;
			task.endFirstSlice();
			task.settleCompletion();
			let { cancellable, readyFn, releaseLock = !1 } = opts;
			if (task.deliverPendingCancel({ cancellable })) return !1;
			let reacquireLock = releaseLock && task.needsExclusiveLock() && cstate.exclusivelyLockedBy(task.id());
			reacquireLock && cstate.exclusiveRelease(task.id());
			try {
				let keepGoing = await cstate.suspendThread({
					...opts,
					cancellable: !!cancellable,
					thread: this,
					readyFn: () => cancellable && task.cancellationPending() || readyFn()
				});
				cstate.throwIfInterrupted();
				if (keepGoing && task.deliverPendingCancel({ cancellable })) return !1;
				return !!keepGoing;
			} finally {
				reacquireLock && !cstate.exclusivelyLockedBy(task.id()) && await cstate.acquireExclusiveLock(task.id());
			}
		}
		start() {
			if (this.#state !== __jcoEmbeddedRuntime$THREAD_NOT_STARTED) throw Error(`cannot start thread [${this.#id}] in state [${this.#state}]`);
			this.#state = __jcoEmbeddedRuntime$THREAD_RUNNING;
			let startFn = this.#startFn;
			this.#startFn = null;
			__jcoEmbeddedRuntime$withCurrentTaskMetaAsync(_registers, {
				threadID: this.#id,
				taskID: this.#task.id(),
				componentIdx: this.#componentIdx,
				fn: async () => {
					__jcoEmbeddedRuntime$getOrCreateAsyncState(_lookup, this.#componentIdx).throwIfInterrupted();
					return startFn();
				}
			}).then(() => {
				this.#state = __jcoEmbeddedRuntime$THREAD_COMPLETED;
				this.#task.removeThread(this);
			}).catch((err) => {
				err = __jcoEmbeddedRuntime$recordTrap(context.traps, this.#componentIdx, err);
				this.#state = __jcoEmbeddedRuntime$THREAD_COMPLETED;
				__jcoEmbeddedRuntime$debugLog("[AsyncThread#start()] spawned thread errored", {
					threadID: this.#id,
					taskID: this.#task.id(),
					componentIdx: this.#componentIdx,
					err
				});
				this.#task.setErrored(err);
				this.#task.reject(err);
				this.#task.removeThread(this);
			});
		}
	}
	return AsyncThread;
}
const __jcoEmbeddedRuntime$initializeStreams = (RepTable) => new RepTable({ target: "global stream map" });
const __jcoEmbeddedRuntime$initializeFutures = (RepTable) => new RepTable({ target: "global future map" });
const __jcoEmbeddedRuntime$decodeUtf8 = (RuntimeError, decoder, input) => {
	try {
		return decoder.decode(input);
	} catch (error) {
		if (!(error instanceof TypeError)) throw error;
		let bytes;
		try {
			bytes = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
		} catch {
			throw error;
		}
		for (let i = 0; i < bytes.length; i++) {
			let lead = bytes[i];
			if (lead < 128) continue;
			let count = lead >= 194 && lead <= 223 ? 1 : lead >= 224 && lead <= 239 ? 2 : lead >= 240 && lead <= 244 ? 3 : -1;
			if (count < 0) throw new RuntimeError("invalid utf-8");
			for (let j = 1; j <= count; j++) {
				if (i + j >= bytes.length) throw new RuntimeError("incomplete utf-8 byte sequence");
				let byte = bytes[i + j];
				if (byte < 128 || byte > 191 || j === 1 && (lead === 224 && byte < 160 || lead === 237 && byte > 159 || lead === 240 && byte < 144 || lead === 244 && byte > 143)) throw new RuntimeError("invalid utf-8");
			}
			i += count;
		}
		throw error;
	}
};
const __jcoEmbeddedRuntime$initializeLiftVariant = () => ({ scratch: new DataView(new ArrayBuffer(8)) });
function __jcoEmbeddedRuntime$liftFlatU8(ctx) {
	__jcoEmbeddedRuntime$debugLog("[_liftFlatU8()] args", { ctx });
	let val;
	if (ctx.useDirectParams) {
		if (ctx.params.length === 0) throw Error("expected at least a single i32 argument");
		val = ctx.params[0];
		ctx.params = ctx.params.slice(1);
		return [val, ctx];
	}
	if (ctx.storageLen !== void 0 && ctx.storageLen < 1) throw Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u8 requires 1 byte)`);
	val = new DataView(ctx.memory.buffer).getUint8(ctx.storagePtr);
	ctx.storagePtr += 1;
	ctx.storageLen !== void 0 && --ctx.storageLen;
	return [val, ctx];
}
function __jcoEmbeddedRuntime$liftFlatU16(ctx) {
	__jcoEmbeddedRuntime$debugLog("[_liftFlatU16()] args", { ctx });
	let val;
	if (ctx.useDirectParams) {
		if (ctx.params.length === 0) throw Error("expected at least a single i32 argument");
		val = ctx.params[0];
		ctx.params = ctx.params.slice(1);
		return [val, ctx];
	}
	if (ctx.storageLen !== void 0 && ctx.storageLen < 2) throw Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u16 requires 2 bytes)`);
	val = new DataView(ctx.memory.buffer).getUint16(ctx.storagePtr, !0);
	ctx.storagePtr += 2;
	ctx.storageLen !== void 0 && (ctx.storageLen -= 2);
	let rem = ctx.storagePtr % 2;
	rem !== 0 && (ctx.storagePtr += 2 - rem);
	return [val, ctx];
}
function __jcoEmbeddedRuntime$liftFlatU32(ctx) {
	__jcoEmbeddedRuntime$debugLog("[_liftFlatU32()] args", { ctx });
	let val;
	if (ctx.useDirectParams) {
		if (ctx.params.length === 0) throw Error("expected at least a single i34 argument");
		val = ctx.params[0] >>> 0;
		ctx.params = ctx.params.slice(1);
		return [val, ctx];
	}
	if (ctx.storageLen !== void 0 && ctx.storageLen < 4) throw Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u32 requires 4 bytes)`);
	val = new DataView(ctx.memory.buffer).getUint32(ctx.storagePtr, !0);
	ctx.storagePtr += 4;
	ctx.storageLen !== void 0 && (ctx.storageLen -= 4);
	return [val, ctx];
}
function __jcoEmbeddedRuntime$liftFlatU64(ctx) {
	__jcoEmbeddedRuntime$debugLog("[_liftFlatU64()] args", { ctx });
	let val;
	if (ctx.useDirectParams) {
		if (ctx.params.length === 0) throw Error("expected at least one single i64 argument");
		if (typeof ctx.params[0] != "bigint") throw Error("expected bigint");
		val = BigInt.asUintN(64, ctx.params[0]);
		ctx.params = ctx.params.slice(1);
		return [val, ctx];
	}
	if (ctx.storageLen !== void 0 && ctx.storageLen < 8) throw Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u64 requires 8 bytes)`);
	val = new DataView(ctx.memory.buffer).getBigUint64(ctx.storagePtr, !0);
	ctx.storagePtr += 8;
	ctx.storageLen !== void 0 && (ctx.storageLen -= 8);
	return [val, ctx];
}
function __jcoEmbeddedRuntime$liftFlatVariant(_context, meta) {
	let { caseMetas, variantSize32, variantAlign32, variantPayloadOffset32, variantFlatCount, variantPayloadFlatTypes, isEnum } = meta;
	return function liftFlatVariantInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_liftFlatVariant()] args", { ctx });
		let origUseParams = ctx.useDirectParams;
		let caseIdx;
		let liftRes;
		let originalPtr = ctx.storagePtr;
		let numCases = caseMetas.length;
		if (caseMetas.length < 256) liftRes = __jcoEmbeddedRuntime$liftFlatU8(ctx);
		else if (numCases >= 256 && numCases < 65536) liftRes = __jcoEmbeddedRuntime$liftFlatU16(ctx);
		else if (numCases >= 65536 && numCases < 4294967296) liftRes = __jcoEmbeddedRuntime$liftFlatU32(ctx);
		else throw Error(`unsupported number of variant cases [${numCases}]`);
		caseIdx = liftRes[0];
		ctx = liftRes[1];
		let [tag, liftFn, , , caseFlatCount, caseFlatTypes] = caseMetas[caseIdx];
		if (variantPayloadOffset32 === void 0) throw Error("unexpectedly missing payload offset");
		originalPtr !== void 0 && (ctx.storagePtr = originalPtr + variantPayloadOffset32);
		let val;
		if (liftFn === null) {
			val = { tag };
			originalPtr !== void 0 && (ctx.storagePtr = originalPtr + variantSize32);
		} else {
			if (ctx.useDirectParams) {
				if (!variantPayloadFlatTypes || !caseFlatTypes) throw Error("missing variant flat type metadata during direct-param lift");
				let scratch = _context.scratch;
				for (let i = 0; i < caseFlatTypes.length; i++) {
					let have = variantPayloadFlatTypes[i];
					let want = caseFlatTypes[i];
					if (have === want) continue;
					let val = ctx.params[i];
					if (have === "i64" && want === "i32") ctx.params[i] = Number(BigInt.asIntN(32, val));
					else if (have === "i64" && want === "f32") {
						scratch.setInt32(0, Number(BigInt.asIntN(32, val)), !0);
						ctx.params[i] = scratch.getFloat32(0, !0);
					} else if (have === "i64" && want === "f64") {
						scratch.setBigInt64(0, val, !0);
						ctx.params[i] = scratch.getFloat64(0, !0);
					} else if (have === "i32" && want === "f32") {
						scratch.setInt32(0, val, !0);
						ctx.params[i] = scratch.getFloat32(0, !0);
					} else throw Error(`invalid variant payload coercion [${have}] -> [${want}]`);
				}
			}
			let [newVal, newCtx] = liftFn(ctx);
			val = {
				tag,
				val: newVal
			};
			ctx = newCtx;
		}
		if (origUseParams) {
			if (variantFlatCount == null) {
				__jcoEmbeddedRuntime$debugLog("[_liftFlatVariant()] variant with unknown flat count", {
					ctx,
					meta
				});
				throw Error("cannot lift variant with unknown flat count");
			}
			if (caseFlatCount == null) {
				__jcoEmbeddedRuntime$debugLog("[_liftFlatVariant()] case with unknown flat count", {
					ctx,
					meta,
					case: meta.caseMetas[caseIdx]
				});
				throw Error("cannot lift case with unknown flat count");
			}
			let remainingPayloadParams = variantFlatCount - caseFlatCount - +!isEnum;
			if (remainingPayloadParams < 0) throw Error("invalid variant flat count metadata");
			if (ctx.params.length < remainingPayloadParams) throw Error(`expected at least [${remainingPayloadParams}] remaining variant payload params, but got [${ctx.params.length}]`);
			ctx.params = ctx.params.slice(remainingPayloadParams);
		}
		if (ctx.storagePtr !== void 0) {
			let rem = ctx.storagePtr % variantAlign32;
			rem !== 0 && (ctx.storagePtr += variantAlign32 - rem);
		}
		return [val, ctx];
	};
}
function __jcoEmbeddedRuntime$liftFlatList(_context, meta) {
	let { elemLiftFn, elemSize32, elemAlign32, knownLen, typedArray } = meta;
	let listValue = typedArray === void 0 ? (values) => values : (values) => new typedArray(values);
	let readValuesAndReset = (ctx, originalPtr, originalLen, dataPtr, len) => {
		if (dataPtr < 0 || len < 0 || elemSize32 !== 0 && len > Math.floor(((1 << 28) - 1) / elemSize32) || dataPtr > ctx.memory.buffer.byteLength || elemSize32 !== 0 && len > Math.floor((ctx.memory.buffer.byteLength - dataPtr) / elemSize32)) throw new _context.RuntimeError("wasm trap: out of bounds memory access");
		if (dataPtr % elemAlign32 !== 0) throw TypeError(`list pointer [${dataPtr}] is not aligned to ${elemAlign32}`);
		ctx.storagePtr = dataPtr;
		let val;
		if (typedArray !== void 0 && (_context.littleEndian || elemSize32 === 1)) {
			ctx.storagePtr = dataPtr + len * elemSize32;
			val = new typedArray(ctx.memory.buffer.slice(dataPtr, ctx.storagePtr));
		} else {
			let values = [];
			for (let i = 0; i < len; i++) {
				let elemPtr = dataPtr + i * elemSize32;
				ctx.storagePtr = elemPtr;
				let [res, nextCtx] = elemLiftFn(ctx);
				values.push(res);
				ctx = nextCtx;
				ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
			}
			val = listValue(values);
		}
		originalPtr !== null && (ctx.storagePtr = originalPtr);
		originalLen !== null && (ctx.storageLen = originalLen);
		return [val, ctx];
	};
	return function liftFlatListInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_liftFlatList()] args", { ctx });
		let liftResults;
		if (knownLen !== void 0) {
			if (ctx.useDirectParams) {
				__jcoEmbeddedRuntime$debugLog("memory unexpectedly missing while lifting unknown length list", { ctx });
				liftResults = [listValue(ctx.params.slice(0, knownLen)), ctx];
				ctx.params = ctx.params.slice(knownLen);
			} else {
				if (ctx.memory === null) {
					__jcoEmbeddedRuntime$debugLog("memory unexpectedly missing while lifting known length list", {
						knownLen,
						ctx
					});
					throw Error(`memory missing while lifting known length (${knownLen}) list`);
				}
				let originalLen = ctx.storageLen;
				ctx.storageLen = knownLen * elemSize32;
				liftResults = readValuesAndReset(ctx, null, originalLen, ctx.storagePtr, knownLen);
			}
		} else if (ctx.useDirectParams) {
			let dataPtr = ctx.params[0] >>> 0;
			let len = ctx.params[1];
			ctx.params = ctx.params.slice(2);
			ctx.useDirectParams = !1;
			let originalPtr = ctx.storagePtr;
			let originalLen = ctx.storageLen;
			ctx.storageLen = len * elemSize32;
			liftResults = readValuesAndReset(ctx, originalPtr, originalLen, dataPtr, len);
			ctx.useDirectParams = !0;
		} else {
			let originalLen = ctx.storageLen;
			ctx.storageLen = 8;
			let dataPtrLiftRes = __jcoEmbeddedRuntime$liftFlatU32(ctx);
			let dataPtr = dataPtrLiftRes[0];
			ctx = dataPtrLiftRes[1];
			let lenLiftRes = __jcoEmbeddedRuntime$liftFlatU32(ctx);
			let len = lenLiftRes[0];
			ctx = lenLiftRes[1];
			let originalPtr = ctx.storagePtr;
			ctx.storagePtr = dataPtr;
			ctx.storageLen = len * elemSize32;
			liftResults = readValuesAndReset(ctx, originalPtr, originalLen, dataPtr, len);
		}
		return liftResults;
	};
}
function __jcoEmbeddedRuntime$liftFlatResult(_context, meta) {
	let f = __jcoEmbeddedRuntime$liftFlatVariant(_context, meta);
	return function liftFlatResultInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_liftFlatResult()] args", { ctx });
		let res = f(ctx);
		let value = res[0];
		"val" in value || (value.val = void 0);
		return res;
	};
}
function __jcoEmbeddedRuntime$liftFlatBorrow(componentTableIdx, size, memory, vals, storagePtr, storageLen) {
	__jcoEmbeddedRuntime$debugLog("[_liftFlatBorrow()] args", {
		size,
		memory,
		vals,
		storagePtr,
		storageLen
	});
	throw Error("flat lift for borrowed resources is not supported!");
}
function __jcoEmbeddedRuntime$lowerFlatU8(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatU8()] args", ctx);
	if (ctx.vals.length !== 1) throw Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
	_context.strict && !__jcoEmbeddedRuntime$isUint8(ctx.vals[0]) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u8", ctx.vals[0]);
	if (!ctx.memory) throw Error("missing memory for lower");
	new DataView(ctx.memory.buffer).setUint8(ctx.storagePtr, ctx.vals[0]);
	ctx.storagePtr += 1;
}
function __jcoEmbeddedRuntime$lowerFlatU16(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatU16()] args", { ctx });
	if (!ctx.memory) throw Error("missing memory for lower");
	if (ctx.vals.length !== 1) throw Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
	let rem = ctx.storagePtr % 2;
	rem !== 0 && (ctx.storagePtr += 2 - rem);
	_context.strict && !__jcoEmbeddedRuntime$isUint16(ctx.vals[0]) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u16", ctx.vals[0]);
	new DataView(ctx.memory.buffer).setUint16(ctx.storagePtr, ctx.vals[0], !0);
	ctx.storagePtr += 2;
}
function __jcoEmbeddedRuntime$lowerFlatU32(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatU32()] args", { ctx });
	if (ctx.vals.length !== 1) throw Error(`expected single value to lower, got [${ctx.vals.length}]`);
	let rem = ctx.storagePtr % 4;
	rem !== 0 && (ctx.storagePtr += 4 - rem);
	_context.strict && !__jcoEmbeddedRuntime$isUint32(ctx.vals[0]) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u32", ctx.vals[0]);
	new DataView(ctx.memory.buffer).setUint32(ctx.storagePtr, ctx.vals[0], !0);
	ctx.storagePtr += 4;
}
function __jcoEmbeddedRuntime$lowerFlatU64(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatU64()] args", { ctx });
	if (ctx.vals.length !== 1) throw Error("unexpected number of vals");
	let rem = ctx.storagePtr % 8;
	rem !== 0 && (ctx.storagePtr += 8 - rem);
	_context.strict && !__jcoEmbeddedRuntime$isUint64(ctx.vals[0]) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u64", ctx.vals[0]);
	new DataView(ctx.memory.buffer).setBigUint64(ctx.storagePtr, ctx.vals[0], !0);
	ctx.storagePtr += 8;
}
function __jcoEmbeddedRuntime$lowerFlatStringAny(_context, ctx) {
	switch (ctx.stringEncoding) {
		case "utf8": return __jcoEmbeddedRuntime$lowerFlatStringUTF8(_context.utf8, ctx);
		case "utf16": return __jcoEmbeddedRuntime$lowerFlatStringUTF16(_context.utf16, ctx);
		case "compact-utf16": {
			if (!ctx.realloc) throw Error("missing realloc during flat string lower");
			let { ptr, len } = __jcoEmbeddedRuntime$compactUtf16Encode(_context.utf16, ctx.vals[0], ctx.realloc, ctx.memory);
			let view = new DataView(ctx.memory.buffer);
			view.setUint32(ctx.storagePtr, ptr, !0);
			view.setUint32(ctx.storagePtr + 4, len, !0);
			ctx.storagePtr += 8;
			return;
		}
		default: throw Error(`missing/unrecognized/unsupported string encoding [${ctx.stringEncoding}]`);
	}
}
function __jcoEmbeddedRuntime$lowerFlatStringUTF16(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatStringUTF16()] args", { ctx });
	if (!ctx.realloc) throw Error("missing realloc during flat string lower");
	let { ptr, len } = __jcoEmbeddedRuntime$utf16Encode(_context, ctx.vals[0], ctx.realloc, ctx.memory);
	let view = new DataView(ctx.memory.buffer);
	view.setUint32(ctx.storagePtr, ptr, !0);
	view.setUint32(ctx.storagePtr + 4, len, !0);
	ctx.storagePtr += 8;
}
function __jcoEmbeddedRuntime$lowerFlatStringUTF8(_context, ctx) {
	__jcoEmbeddedRuntime$debugLog("[_lowerFlatStringUTF8()] args", ctx);
	if (!ctx.realloc) throw Error("missing realloc during flat string lower");
	let { ptr, len } = __jcoEmbeddedRuntime$utf8Encode(_context, ctx.vals[0], ctx.realloc, ctx.memory);
	let view = new DataView(ctx.memory.buffer);
	view.setUint32(ctx.storagePtr, ptr, !0);
	view.setUint32(ctx.storagePtr + 4, len, !0);
	ctx.storagePtr += 8;
}
function __jcoEmbeddedRuntime$lowerFlatVariant(_context, meta) {
	let { variantSize32, variantAlign32, variantPayloadOffset32, caseMetas } = meta;
	let caseLookup = Object.create(null);
	for (let [idx, meta] of caseMetas.entries()) {
		let tag = meta[0];
		caseLookup[tag] = {
			discriminant: idx,
			meta
		};
	}
	return function lowerFlatVariantInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatVariant()] args", { ctx });
		let { tag, val } = ctx.vals[0];
		let variantCase = caseLookup[tag];
		if (!variantCase) throw Error(`missing tag [${tag}] (valid tags: ${Object.keys(caseLookup)})`);
		let [, lowerFn] = variantCase.meta;
		let originalPtr = ctx.storagePtr;
		ctx.vals = [variantCase.discriminant];
		if (caseMetas.length < 256) __jcoEmbeddedRuntime$lowerFlatU8(_context, ctx);
		else if (caseMetas.length >= 256 && caseMetas.length < 65536) __jcoEmbeddedRuntime$lowerFlatU16(_context, ctx);
		else if (caseMetas.length >= 65536 && caseMetas.length < 4294967296) __jcoEmbeddedRuntime$lowerFlatU32(_context, ctx);
		else throw Error(`unsupported number of cases [${caseMetas.length}]`);
		ctx.storagePtr = originalPtr + variantPayloadOffset32;
		ctx.vals = [val];
		lowerFn && lowerFn(ctx);
		ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + variantSize32);
		let rem = ctx.storagePtr % variantAlign32;
		rem !== 0 && (ctx.storagePtr += variantAlign32 - rem);
	};
}
function __jcoEmbeddedRuntime$lowerFlatList(_context, meta) {
	let { elemLowerFn, knownLen, size32, elemSize32, elemAlign32, typedArray } = meta;
	if (!elemLowerFn) throw TypeError("missing/invalid element lower fn for list");
	return function lowerFlatListInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatList()] args", { ctx });
		if (ctx.useDirectParams) {
			if (ctx.params.length < 2) throw Error("insufficient params left to lower list");
			let storagePtr = ctx.params[0] >>> 0;
			let elemCount = ctx.params[1];
			ctx.params = ctx.params.slice(2);
			let list = ctx.vals[0];
			if (!list) throw Error("missing direct param value");
			if (elemCount !== list.length) throw Error("list length does not match allocated storage");
			let lowerCtx = {
				storagePtr,
				memory: ctx.memory,
				stringEncoding: ctx.stringEncoding,
				componentIdx: ctx.componentIdx,
				realloc: ctx.realloc,
				lowerResource: ctx.lowerResource,
				vals: []
			};
			for (let idx = 0; idx < list.length; idx++) {
				let elemPtr = storagePtr + idx * elemSize32;
				lowerCtx.storagePtr = elemPtr;
				lowerCtx.vals = list.slice(idx, idx + 1);
				elemLowerFn(lowerCtx);
				lowerCtx.storagePtr = Math.max(lowerCtx.storagePtr, elemPtr + elemSize32);
			}
			ctx.storagePtr = lowerCtx.storagePtr;
			return;
		}
		let elems = ctx.vals[0];
		let totalSizeBytes = knownLen === void 0 ? 8 : size32 ?? elems.length * elemSize32;
		if (ctx.storageLen !== void 0 && totalSizeBytes > ctx.storageLen) throw Error("not enough storage remaining for list flat lower");
		if (knownLen === void 0) {
			if (!ctx.realloc) throw Error("missing realloc during flat string lower");
			let dataPtr = ctx.realloc(0, 0, elemAlign32, elemSize32 * elems.length);
			ctx.vals[0] = dataPtr;
			__jcoEmbeddedRuntime$lowerFlatU32(_context.numeric, ctx);
			ctx.vals[0] = elems.length;
			__jcoEmbeddedRuntime$lowerFlatU32(_context.numeric, ctx);
			let origPtr = ctx.storagePtr;
			ctx.storagePtr = dataPtr;
			if (typedArray !== void 0 && elems instanceof typedArray && (_context.littleEndian || elemSize32 === 1)) new Uint8Array(ctx.memory.buffer, dataPtr, elems.byteLength).set(new Uint8Array(elems.buffer, elems.byteOffset, elems.byteLength));
			else for (let [idx, elem] of elems.entries()) {
				let elemPtr = dataPtr + idx * elemSize32;
				ctx.storagePtr = elemPtr;
				ctx.vals = [elem];
				elemLowerFn(ctx);
				ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
			}
			ctx.storagePtr = origPtr;
		} else {
			if (elems.length !== knownLen) throw TypeError(`invalid list input of length [${elems.length}], must be length [${knownLen}]`);
			let originalPtr = ctx.storagePtr;
			for (let [idx, elem] of elems.entries()) {
				let elemPtr = originalPtr + idx * elemSize32;
				ctx.storagePtr = elemPtr;
				ctx.vals = [elem];
				elemLowerFn(ctx);
				ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + elemSize32);
			}
		}
	};
}
function __jcoEmbeddedRuntime$lowerFlatTuple(meta) {
	let { elemLowerMetas, size32: tupleSize32, align32: tupleAlign32 } = meta;
	return function lowerFlatTupleInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatTuple()] args", { ctx });
		let originalPtr = ctx.storagePtr;
		let tuple = ctx.vals[0];
		for (let [idx, [lowerFn, size32, align32]] of elemLowerMetas.entries()) {
			let rem = ctx.storagePtr % align32;
			rem !== 0 && (ctx.storagePtr += align32 - rem);
			let elemPtr = ctx.storagePtr;
			ctx.vals = [tuple[idx]];
			lowerFn(ctx);
			ctx.storagePtr = Math.max(ctx.storagePtr, elemPtr + size32);
		}
		ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + tupleSize32);
		let rem = ctx.storagePtr % tupleAlign32;
		rem !== 0 && (ctx.storagePtr += tupleAlign32 - rem);
	};
}
function __jcoEmbeddedRuntime$lowerFlatOption(_context, meta) {
	let { payloadMaybeNull } = meta;
	let f = __jcoEmbeddedRuntime$lowerFlatVariant(_context, meta);
	return function lowerFlatOptionInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatOption()] args", { ctx });
		let v = ctx.vals[0];
		v == null ? ctx.vals[0] = { tag: "none" } : payloadMaybeNull ? (typeof v != "object" || Object.keys(v).length !== 2 || !("tag" in v) || v.tag !== "some" && v.tag !== "none" || !("val" in v)) && (ctx.vals[0] = {
			tag: "some",
			val: v
		}) : ctx.vals[0] = {
			tag: "some",
			val: v
		};
		f(ctx);
	};
}
function __jcoEmbeddedRuntime$lowerFlatResult(_context, meta) {
	let f = __jcoEmbeddedRuntime$lowerFlatVariant(_context, meta);
	return function lowerFlatResultInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatResult()] args", { ctx });
		let v = ctx.vals[0];
		typeof v == "object" && v && Object.keys(v).length === 2 && "tag" in v && (v.tag === "ok" || v.tag === "err") && "val" in v || (ctx.vals[0] = {
			tag: "ok",
			val: v
		});
		f(ctx);
	};
}
function __jcoEmbeddedRuntime$lowerFlatOwn(_context, meta) {
	let { lowerFn, componentIdx, tableIdx } = meta;
	return function lowerFlatOwnInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatOwn()] args", { ctx });
		if (ctx.componentIdx !== componentIdx) throw Error(`component index mismatch (expected [${componentIdx}], lift called from [${ctx.componentIdx}])`);
		let obj = ctx.vals[0];
		if (obj == null) throw Error("missing resource");
		let handle = ctx.lowerResource ? ctx.lowerResource(obj, tableIdx) : lowerFn(obj);
		ctx.vals[0] = handle;
		__jcoEmbeddedRuntime$lowerFlatU32(_context, ctx);
	};
}
function __jcoEmbeddedRuntime$initializeFutureValueClass(disposeSymbol) {
	var _a;
	class FutureValue {
		#start;
		#dropFn;
		#dropped = !1;
		#delivered = !1;
		#settled;
		#hideThen = 0;
		#thenFn;
		constructor(start, dropFn) {
			if (typeof start != "function") throw TypeError("future start operation must be a function");
			this.#start = start;
			this.#dropFn = dropFn;
			this.#thenFn = this.#then.bind(this);
		}
		get then() {
			return this.#hideThen === 0 ? this.#thenFn : void 0;
		}
		#read() {
			this.#settled ||= Promise.resolve().then(this.#start);
			return this.#settled;
		}
		resolveAsValue(resolve) {
			this.#hideThen++;
			try {
				resolve(this);
			} finally {
				this.#hideThen--;
			}
		}
		#deliver(resolve, value) {
			if (value instanceof _a) {
				value.resolveAsValue(resolve);
				return;
			}
			resolve(value);
		}
		#then(resolve, reject) {
			let droppedError = () => Error("future was dropped");
			return (this.#dropped ? Promise.reject(droppedError()) : this.#read()).then((box) => {
				if (this.#dropped) {
					if (typeof reject == "function") return reject(droppedError());
					throw droppedError();
				}
				this.#delivered = !0;
				return this.#deliver(resolve, box.value);
			}, reject);
		}
		[disposeSymbol]() {
			if (this.#dropped) return;
			this.#dropped = !0;
			this.#dropFn?.();
			this.#settled?.then((box) => {
				this.#delivered || __jcoEmbeddedRuntime$disposeHostValue(disposeSymbol, box.value);
			}, () => {});
		}
	}
	_a = FutureValue;
	return FutureValue;
}
const createNewCurrentImplicitThread = __jcoEmbeddedRuntime$createNewCurrentImplicitThread;
const getCurrentTask = __jcoEmbeddedRuntime$getCurrentTask;
const getCurrentThread = __jcoEmbeddedRuntime$getCurrentThread;
const _jcoInitializeAsyncSubtaskClass = __jcoEmbeddedRuntime$initializeAsyncSubtaskClass;
const _jcoInitializeAsyncTaskClass = __jcoEmbeddedRuntime$initializeAsyncTaskClass;
const _jcoInitializeAsyncThreadClass = __jcoEmbeddedRuntime$initializeAsyncThreadClass;
const _jcoInitializeCurrentComponentIdxs = __jcoEmbeddedRuntime$initializeCurrentComponentIdxs;
const _jcoInitializeCurrentTaskIds = __jcoEmbeddedRuntime$initializeCurrentTaskIds;
const _jcoInitializeCurrentTaskMayBlock = __jcoEmbeddedRuntime$initializeCurrentTaskMayBlock;
const _jcoInitializeTasksByComponent = __jcoEmbeddedRuntime$initializeTasksByComponent;
const _lowerImportBackwardsCompat = __jcoEmbeddedRuntime$lowerImportBackwardsCompat;
const _checkIdle = __jcoEmbeddedRuntime$checkIdle;
const getOrCreateAsyncState = __jcoEmbeddedRuntime$getOrCreateAsyncState;
const _guardMayLeave = __jcoEmbeddedRuntime$guardMayLeave;
const _guardTrap = __jcoEmbeddedRuntime$guardTrap;
const _jcoInitializeComponentAsyncStateClass = __jcoEmbeddedRuntime$initializeComponentAsyncStateClass;
const _jcoInitializeComponentAsyncStates = __jcoEmbeddedRuntime$initializeComponentAsyncStates;
const _jcoInitializeCoreTrapMessages = __jcoEmbeddedRuntime$initializeCoreTrapMessages;
const _jcoInitializeInstanceFlags = __jcoEmbeddedRuntime$initializeInstanceFlags;
const _jcoInitializeStoreAsyncState = __jcoEmbeddedRuntime$initializeStoreAsyncState;
const _jcoInitializeStoreTrap = __jcoEmbeddedRuntime$initializeStoreTrap;
const _postReturnTrap = __jcoEmbeddedRuntime$postReturnTrap;
const _reportTrap = __jcoEmbeddedRuntime$reportTrap;
const _stopInstance = __jcoEmbeddedRuntime$stopInstance;
const _trackHostOperation = __jcoEmbeddedRuntime$trackHostOperation;
const _whenIdle = __jcoEmbeddedRuntime$whenIdle;
const _requireValidNumericPrimitive = __jcoEmbeddedRuntime$requireValidNumericPrimitive;
const toUint64 = __jcoEmbeddedRuntime$toUint64;
const base64Compile = __jcoEmbeddedRuntime$base64Compile;
const _debugLog = __jcoEmbeddedRuntime$debugLog;
const fetchCompile = __jcoEmbeddedRuntime$fetchCompile;
const _getGlobalCurrentThreadMeta = __jcoEmbeddedRuntime$getCurrentTaskMeta;
const getErrorPayload = __jcoEmbeddedRuntime$getErrorPayload;
const _jcoInitializeAsyncDeterminism = __jcoEmbeddedRuntime$initializeAsyncDeterminism;
const _jcoInitializeAsyncEventCodes = __jcoEmbeddedRuntime$initializeAsyncEventCodes;
const _jcoInitializeComponentMemoryMap = __jcoEmbeddedRuntime$initializeComponentMemoryMap;
const _jcoInitializeEndianness = __jcoEmbeddedRuntime$initializeEndianness;
const _jcoInitializeFileCompileCache = __jcoEmbeddedRuntime$initializeFileCompileCache;
const _jcoInitializeHasOwnProperty = __jcoEmbeddedRuntime$initializeHasOwnProperty;
const _jcoInitializeRepTableClass = __jcoEmbeddedRuntime$initializeRepTableClass;
const _jcoInitializeRuntimeErrorConstructor = __jcoEmbeddedRuntime$initializeRuntimeErrorConstructor;
const _jcoInitializeSymbolCabiDispose = __jcoEmbeddedRuntime$initializeSymbolCabiDispose;
const _jcoInitializeSymbolDispose = __jcoEmbeddedRuntime$initializeSymbolDispose;
const _jcoInitializeSymbolResourceHandle = __jcoEmbeddedRuntime$initializeSymbolResourceHandle;
const _jcoInitializeSymbolResourceRep = __jcoEmbeddedRuntime$initializeSymbolResourceRep;
const _jcoInitializeTaskRegisters = __jcoEmbeddedRuntime$initializeTaskRegisters;
const instantiateCore = __jcoEmbeddedRuntime$instantiateCore;
const _withGlobalCurrentThreadMeta = __jcoEmbeddedRuntime$withCurrentTaskMeta;
const _jcoInitializeFutureValueClass = __jcoEmbeddedRuntime$initializeFutureValueClass;
const _jcoInitializeFutures = __jcoEmbeddedRuntime$initializeFutures;
const dataView = __jcoEmbeddedRuntime$dataView;
const _jcoInitializeDataViewCache = __jcoEmbeddedRuntime$initializeDataViewCache;
const _decodeUtf8 = __jcoEmbeddedRuntime$decodeUtf8;
const _jcoInitializeLiftVariant = __jcoEmbeddedRuntime$initializeLiftVariant;
const _liftFlatBorrow = __jcoEmbeddedRuntime$liftFlatBorrow;
const _liftFlatList = __jcoEmbeddedRuntime$liftFlatList;
const _liftFlatResult = __jcoEmbeddedRuntime$liftFlatResult;
const _liftFlatU64 = __jcoEmbeddedRuntime$liftFlatU64;
const _liftFlatU8 = __jcoEmbeddedRuntime$liftFlatU8;
const _lowerFlatList = __jcoEmbeddedRuntime$lowerFlatList;
const _lowerFlatOption = __jcoEmbeddedRuntime$lowerFlatOption;
const _lowerFlatOwn = __jcoEmbeddedRuntime$lowerFlatOwn;
const _lowerFlatResult = __jcoEmbeddedRuntime$lowerFlatResult;
const _lowerFlatStringAny = __jcoEmbeddedRuntime$lowerFlatStringAny;
const _lowerFlatTuple = __jcoEmbeddedRuntime$lowerFlatTuple;
const _lowerFlatU32 = __jcoEmbeddedRuntime$lowerFlatU32;
const _lowerFlatU64 = __jcoEmbeddedRuntime$lowerFlatU64;
const _lowerFlatVariant = __jcoEmbeddedRuntime$lowerFlatVariant;
const _jcoInitializeCurrentBorrows = __jcoEmbeddedRuntime$initializeCurrentBorrows;
const _jcoInitializeHandleIndexSpaces = __jcoEmbeddedRuntime$initializeHandleIndexSpaces;
const _jcoInitializeHandleTables = __jcoEmbeddedRuntime$initializeHandleTables;
const _jcoInitializeResourceScopeCounter = __jcoEmbeddedRuntime$initializeResourceScopeCounter;
const _jcoInitializeResourceScopeTasks = __jcoEmbeddedRuntime$initializeResourceScopeTasks;
const rscTableCreateOwn = __jcoEmbeddedRuntime$tableCreateOwn;
const T_FLAG = 1073741824;
const T_OWN = __jcoEmbeddedRuntime$tableOwn;
const rscTableRemove = __jcoEmbeddedRuntime$tableRemove;
const _jcoInitializeStreams = __jcoEmbeddedRuntime$initializeStreams;
const _jcoInitializeUtf16Encoding = __jcoEmbeddedRuntime$initializeUtf16Encoding;
const _jcoInitializeUtf8Decoder = __jcoEmbeddedRuntime$initializeUtf8Decoder;
const _jcoInitializeUtf8Encoder = __jcoEmbeddedRuntime$initializeUtf8Encoder;
const _utf8AllocateAndEncode = __jcoEmbeddedRuntime$utf8Encode;
const _jcoInitializeWaitableClass = __jcoEmbeddedRuntime$initializeWaitableClass;
import { environment, exit as exit$1, stderr, stdin, stdout, terminalInput, terminalOutput, terminalStderr, terminalStdin, terminalStdout } from "@bytecodealliance/preview2-shim/cli";
import { monotonicClock } from "@bytecodealliance/preview2-shim/clocks";
import { error, poll as poll$1, streams } from "@bytecodealliance/preview2-shim/io";
const { getEnvironment } = environment;
if (getEnvironment === void 0) {
	let err = Error("unexpectedly undefined local import 'getEnvironment', was 'getEnvironment' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { exit } = exit$1;
if (exit === void 0) {
	let err = Error("unexpectedly undefined local import 'exit', was 'exit' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getStderr } = stderr;
if (getStderr === void 0) {
	let err = Error("unexpectedly undefined local import 'getStderr', was 'getStderr' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getStdin } = stdin;
if (getStdin === void 0) {
	let err = Error("unexpectedly undefined local import 'getStdin', was 'getStdin' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getStdout } = stdout;
if (getStdout === void 0) {
	let err = Error("unexpectedly undefined local import 'getStdout', was 'getStdout' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { TerminalInput } = terminalInput;
if (TerminalInput === void 0) {
	let err = Error("unexpectedly undefined local import 'TerminalInput', was 'TerminalInput' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { TerminalOutput } = terminalOutput;
if (TerminalOutput === void 0) {
	let err = Error("unexpectedly undefined local import 'TerminalOutput', was 'TerminalOutput' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getTerminalStderr } = terminalStderr;
if (getTerminalStderr === void 0) {
	let err = Error("unexpectedly undefined local import 'getTerminalStderr', was 'getTerminalStderr' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getTerminalStdin } = terminalStdin;
if (getTerminalStdin === void 0) {
	let err = Error("unexpectedly undefined local import 'getTerminalStdin', was 'getTerminalStdin' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { getTerminalStdout } = terminalStdout;
if (getTerminalStdout === void 0) {
	let err = Error("unexpectedly undefined local import 'getTerminalStdout', was 'getTerminalStdout' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { subscribeDuration } = monotonicClock;
if (subscribeDuration === void 0) {
	let err = Error("unexpectedly undefined local import 'subscribeDuration', was 'subscribeDuration' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { Error: Error$1 } = error;
if (Error$1 === void 0) {
	let err = Error("unexpectedly undefined local import 'Error$1', was 'Error' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { Pollable, poll } = poll$1;
if (Pollable === void 0) {
	let err = Error("unexpectedly undefined local import 'Pollable', was 'Pollable' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
if (poll === void 0) {
	let err = Error("unexpectedly undefined local import 'poll', was 'poll' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { InputStream, OutputStream } = streams;
if (InputStream === void 0) {
	let err = Error("unexpectedly undefined local import 'InputStream', was 'InputStream' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
if (OutputStream === void 0) {
	let err = Error("unexpectedly undefined local import 'OutputStream', was 'OutputStream' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const _jcoDataViewCacheContext = _jcoInitializeDataViewCache();
const _jcoStrictNumericContext = { strict: !1 };
const TEXT_DECODER_UTF8 = _jcoInitializeUtf8Decoder();
const TEXT_ENCODER_UTF8 = _jcoInitializeUtf8Encoder();
const HANDLE_INDEX_SPACES = _jcoInitializeHandleIndexSpaces();
const RESOURCE_SCOPE_TASKS = _jcoInitializeResourceScopeTasks();
const _jcoResourceRemoveContext = {
	RuntimeError: WebAssembly.RuntimeError,
	indexSpaces: HANDLE_INDEX_SPACES,
	scopeTasks: RESOURCE_SCOPE_TASKS
};
const _jcoCurrentBorrowContext = _jcoInitializeCurrentBorrows();
const ASYNC_TASKS_BY_COMPONENT_IDX = _jcoInitializeTasksByComponent();
const CURRENT_TASK_META = _jcoInitializeTaskRegisters();
const _jcoTaskLookupContext = {
	tasks: ASYNC_TASKS_BY_COMPONENT_IDX,
	registers: CURRENT_TASK_META
};
const ASYNC_STATE = _jcoInitializeComponentAsyncStates();
const Waitable = _jcoInitializeWaitableClass();
const RepTable = _jcoInitializeRepTableClass({ RuntimeError: WebAssembly.RuntimeError });
const INSTANCE_FLAGS = _jcoInitializeInstanceFlags();
const STORE_TRAP = _jcoInitializeStoreTrap();
const CORE_TRAP_MESSAGES = _jcoInitializeCoreTrapMessages({
	unreachable: "wasm trap: wasm `unreachable` instruction executed",
	"memory access out of bounds": "wasm trap: out of bounds memory access",
	"divide by zero": "wasm trap: integer divide by zero",
	"remainder by zero": "wasm trap: integer divide by zero",
	"divide result unrepresentable": "wasm trap: integer overflow",
	"float unrepresentable in integer range": "wasm trap: invalid conversion to integer",
	"table index is out of bounds": "wasm trap: undefined element: out of bounds table access",
	"function signature mismatch": "wasm trap: indirect call type mismatch",
	"call stack exhausted": "wasm trap: call stack exhausted"
});
const _jcoComponentNormalizeTrapContext = {
	RuntimeError: WebAssembly.RuntimeError,
	messages: CORE_TRAP_MESSAGES
};
const STORE_ASYNC_STATE = _jcoInitializeStoreAsyncState();
const _jcoComponentDeadlockContext = {
	RuntimeError: WebAssembly.RuntimeError,
	storeTrap: STORE_TRAP,
	storeAsyncState: STORE_ASYNC_STATE,
	asyncState: ASYNC_STATE
};
const _jcoComponentStateLookupContext = {
	asyncState: ASYNC_STATE,
	ComponentAsyncState: _jcoInitializeComponentAsyncStateClass({
		RuntimeError: WebAssembly.RuntimeError,
		RepTable,
		indexSpaces: HANDLE_INDEX_SPACES,
		instanceFlags: INSTANCE_FLAGS,
		storeTrap: STORE_TRAP,
		normalization: _jcoComponentNormalizeTrapContext,
		cannotEnter: "wasm trap: cannot enter component instance",
		deadlock: _jcoComponentDeadlockContext,
		Waitable,
		reportTrap: (err) => _reportTrap(_jcoComponentReportTrapContext, err),
		checkIdle: () => _checkIdle(_jcoComponentIdleContext)
	})
};
const _jcoThreadLookupContext = {
	lookup: _jcoComponentStateLookupContext,
	registers: CURRENT_TASK_META
};
const GLOBAL_COMPONENT_MEMORY_MAP = _jcoInitializeComponentMemoryMap();
const symbolDispose = _jcoInitializeSymbolDispose();
const AsyncSubtask = _jcoInitializeAsyncSubtaskClass({
	RuntimeError: WebAssembly.RuntimeError,
	lookup: _jcoComponentStateLookupContext,
	memories: GLOBAL_COMPONENT_MEMORY_MAP,
	disposeSymbol: symbolDispose
});
const _jcoComponentPostReturnTrapContext = {
	RuntimeError: WebAssembly.RuntimeError,
	lookup: _jcoComponentStateLookupContext,
	stackOverflow: "wasm trap: call stack exhausted",
	uncaughtException: "wasm trap: uncaught exception propagated out of component"
};
const _jcoComponentRecordTrapContext = {
	RuntimeError: WebAssembly.RuntimeError,
	registers: CURRENT_TASK_META,
	lookup: _jcoComponentStateLookupContext
};
const WebAssemblyRuntimeError = _jcoInitializeRuntimeErrorConstructor(WebAssembly);
const ASYNC_EVENT_CODE = _jcoInitializeAsyncEventCodes();
const ASYNC_DETERMINISM = _jcoInitializeAsyncDeterminism("random");
const _jcoResourceScopeCounterContext = _jcoInitializeResourceScopeCounter();
const ASYNC_CURRENT_TASK_IDS = _jcoInitializeCurrentTaskIds();
const ASYNC_CURRENT_COMPONENT_IDXS = _jcoInitializeCurrentComponentIdxs();
const _jcoTaskCreateContext = {
	AsyncTask: _jcoInitializeAsyncTaskClass({
		RuntimeError: WebAssemblyRuntimeError,
		postReturn: _jcoComponentPostReturnTrapContext,
		traps: _jcoComponentRecordTrapContext,
		AsyncSubtask,
		Waitable,
		lookup: _jcoComponentStateLookupContext,
		events: ASYNC_EVENT_CODE,
		determinism: ASYNC_DETERMINISM,
		scopeCounter: _jcoResourceScopeCounterContext,
		scopeTasks: RESOURCE_SCOPE_TASKS,
		storeTrap: STORE_TRAP,
		clearing: {
			tasks: ASYNC_TASKS_BY_COMPONENT_IDX,
			taskIds: ASYNC_CURRENT_TASK_IDS,
			componentIdxs: ASYNC_CURRENT_COMPONENT_IDXS,
			checkIdle: () => _checkIdle(_jcoComponentIdleContext)
		},
		registers: CURRENT_TASK_META,
		FutureValue: _jcoInitializeFutureValueClass(symbolDispose)
	}),
	AsyncThread: _jcoInitializeAsyncThreadClass({
		lookup: _jcoComponentStateLookupContext,
		registers: CURRENT_TASK_META,
		traps: _jcoComponentRecordTrapContext
	}),
	tasks: ASYNC_TASKS_BY_COMPONENT_IDX,
	taskIds: ASYNC_CURRENT_TASK_IDS,
	componentIdxs: ASYNC_CURRENT_COMPONENT_IDXS
};
const _jcoComponentMayLeaveContext = {
	RuntimeError: WebAssembly.RuntimeError,
	instanceFlags: INSTANCE_FLAGS
};
const _jcoTaskCompatImportContext = {
	tasks: ASYNC_TASKS_BY_COMPONENT_IDX,
	registers: CURRENT_TASK_META,
	lookup: _jcoComponentStateLookupContext,
	creation: _jcoTaskCreateContext,
	mayLeave: _jcoComponentMayLeaveContext,
	events: ASYNC_EVENT_CODE
};
const CURRENT_TASK_MAY_BLOCK = _jcoInitializeCurrentTaskMayBlock(typeof WebAssembly > "u" ? !1 : { Global: WebAssembly.Global });
const isLE = _jcoInitializeEndianness();
const _jcoLiftListContext = {
	RuntimeError: WebAssemblyRuntimeError,
	littleEndian: isLE
};
const _jcoLiftVariantContext = _jcoInitializeLiftVariant();
const _jcoLowerStringContext = {
	utf8: TEXT_ENCODER_UTF8,
	utf16: _jcoInitializeUtf16Encoding()
};
const _jcoLowerListContext = {
	numeric: _jcoStrictNumericContext,
	littleEndian: isLE
};
const STREAMS = _jcoInitializeStreams(RepTable);
const FUTURES = _jcoInitializeFutures(RepTable);
const _jcoComponentStopContext = {
	RuntimeError: WebAssembly.RuntimeError,
	storeTrap: STORE_TRAP,
	storeAsyncState: STORE_ASYNC_STATE,
	asyncState: ASYNC_STATE,
	tasks: ASYNC_TASKS_BY_COMPONENT_IDX,
	symbolDispose,
	RepTable,
	channels: [STREAMS, FUTURES]
};
const _jcoComponentIdleContext = {
	storeTrap: STORE_TRAP,
	storeAsyncState: STORE_ASYNC_STATE,
	tasks: ASYNC_TASKS_BY_COMPONENT_IDX
};
const _jcoComponentReportTrapContext = {
	RuntimeError: WebAssembly.RuntimeError,
	storeTrap: STORE_TRAP,
	normalization: _jcoComponentNormalizeTrapContext
};
const _jcoComponentHostOperationContext = {
	RuntimeError: WebAssembly.RuntimeError,
	storeTrap: STORE_TRAP,
	storeAsyncState: STORE_ASYNC_STATE,
	asyncState: ASYNC_STATE,
	symbolDispose
};
const _jcoBase64CompileContext = {
	WebAssembly,
	nodejsCompat: !0
};
const _jcoFileCompileCache = _jcoInitializeFileCompileCache(!0);
const _jcoFetchCompileContext = {
	WebAssembly,
	nodejsCompat: !0,
	fileCache: _jcoFileCompileCache
};
const symbolCabiDispose = _jcoInitializeSymbolCabiDispose();
const symbolRscHandle = _jcoInitializeSymbolResourceHandle();
const symbolRscRep = _jcoInitializeSymbolResourceRep();
const HANDLE_TABLES = _jcoInitializeHandleTables();
const hasOwnProperty = _jcoInitializeHasOwnProperty();
WebAssembly.RuntimeError;
let exports0;
const _trampoline6 = function(arg0) {
	let variant0;
	switch (arg0) {
		case 0:
			variant0 = {
				tag: "ok",
				val: void 0
			};
			break;
		case 1:
			variant0 = {
				tag: "err",
				val: void 0
			};
			break;
		default: throw TypeError("invalid variant discriminant for expected");
	}
	_debugLog("[iface=\"wasi:cli/exit@0.2.12\", function=\"exit\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "exit",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		_withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => exit(variant0))
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	_debugLog("[iface=\"wasi:cli/exit@0.2.12\", function=\"exit\"][Instruction::Return]", {
		funcName: "exit",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline6.fnName = "wasi:cli/exit@0.2.12#exit";
const handleTable0 = [T_FLAG, 0];
handleTable0._createdReps = new Set();
handleTable0._componentIdx = 0;
const captureTable0 = new Map();
let captureCnt0 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable0,
	captures: captureTable0
});
HANDLE_TABLES[0] = handleTable0;
const _trampoline7 = function(arg0) {
	var handle1 = arg0;
	var rep2 = handleTable0[(handle1 << 1) + 1] % T_OWN;
	var rsc0 = captureTable0.get(rep2);
	if (!rsc0) {
		rsc0 = Object.create(Pollable.prototype);
		Object.defineProperty(rsc0, symbolRscHandle, {
			writable: !0,
			value: handle1
		});
		Object.defineProperty(rsc0, symbolRscRep, {
			writable: !0,
			value: rep2
		});
	}
	_jcoCurrentBorrowContext.borrows.push(rsc0);
	_debugLog("[iface=\"wasi:io/poll@0.2.12\", function=\"[method]pollable.block\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "block",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		_withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => rsc0.block())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	_debugLog("[iface=\"wasi:io/poll@0.2.12\", function=\"[method]pollable.block\"][Instruction::Return]", {
		funcName: "[method]pollable.block",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline7.fnName = "wasi:io/poll@0.2.12#block";
const handleTable3 = [T_FLAG, 0];
handleTable3._createdReps = new Set();
handleTable3._componentIdx = 0;
const captureTable3 = new Map();
let captureCnt3 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable3,
	captures: captureTable3
});
HANDLE_TABLES[3] = handleTable3;
const _trampoline8 = function(arg0) {
	var handle1 = arg0;
	var rep2 = handleTable3[(handle1 << 1) + 1] % T_OWN;
	var rsc0 = captureTable3.get(rep2);
	if (!rsc0) {
		rsc0 = Object.create(OutputStream.prototype);
		Object.defineProperty(rsc0, symbolRscHandle, {
			writable: !0,
			value: handle1
		});
		Object.defineProperty(rsc0, symbolRscRep, {
			writable: !0,
			value: rep2
		});
	}
	_jcoCurrentBorrowContext.borrows.push(rsc0);
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.subscribe\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "subscribe",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => rsc0.subscribe())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	if (!(ret instanceof Pollable)) throw TypeError("Resource error: Not a valid \"Pollable\" resource.");
	var handle3 = ret[symbolRscHandle];
	if (!handle3) {
		let rep = (ret[symbolRscRep] ?? ++captureCnt0) >>> 0;
		captureTable0.set(rep, ret);
		handle3 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable0, rep);
	}
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.subscribe\"][Instruction::Return]", {
		funcName: "[method]output-stream.subscribe",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([handle3]);
	task.exit();
	return handle3;
};
_trampoline8.fnName = "wasi:io/streams@0.2.12#subscribe";
const handleTable2 = [T_FLAG, 0];
handleTable2._createdReps = new Set();
handleTable2._componentIdx = 0;
const captureTable2 = new Map();
let captureCnt2 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable2,
	captures: captureTable2
});
HANDLE_TABLES[2] = handleTable2;
const _trampoline9 = function() {
	_debugLog("[iface=\"wasi:cli/stdin@0.2.12\", function=\"get-stdin\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getStdin",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getStdin())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	if (!(ret instanceof InputStream)) throw TypeError("Resource error: Not a valid \"InputStream\" resource.");
	var handle0 = ret[symbolRscHandle];
	if (!handle0) {
		let rep = (ret[symbolRscRep] ?? ++captureCnt2) >>> 0;
		captureTable2.set(rep, ret);
		handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable2, rep);
	}
	_debugLog("[iface=\"wasi:cli/stdin@0.2.12\", function=\"get-stdin\"][Instruction::Return]", {
		funcName: "get-stdin",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([handle0]);
	task.exit();
	return handle0;
};
_trampoline9.fnName = "wasi:cli/stdin@0.2.12#getStdin";
const _trampoline10 = function() {
	_debugLog("[iface=\"wasi:cli/stdout@0.2.12\", function=\"get-stdout\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getStdout",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getStdout())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	if (!(ret instanceof OutputStream)) throw TypeError("Resource error: Not a valid \"OutputStream\" resource.");
	var handle0 = ret[symbolRscHandle];
	if (!handle0) {
		let rep = (ret[symbolRscRep] ?? ++captureCnt3) >>> 0;
		captureTable3.set(rep, ret);
		handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable3, rep);
	}
	_debugLog("[iface=\"wasi:cli/stdout@0.2.12\", function=\"get-stdout\"][Instruction::Return]", {
		funcName: "get-stdout",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([handle0]);
	task.exit();
	return handle0;
};
_trampoline10.fnName = "wasi:cli/stdout@0.2.12#getStdout";
const _trampoline11 = function() {
	_debugLog("[iface=\"wasi:cli/stderr@0.2.12\", function=\"get-stderr\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getStderr",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getStderr())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	if (!(ret instanceof OutputStream)) throw TypeError("Resource error: Not a valid \"OutputStream\" resource.");
	var handle0 = ret[symbolRscHandle];
	if (!handle0) {
		let rep = (ret[symbolRscRep] ?? ++captureCnt3) >>> 0;
		captureTable3.set(rep, ret);
		handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable3, rep);
	}
	_debugLog("[iface=\"wasi:cli/stderr@0.2.12\", function=\"get-stderr\"][Instruction::Return]", {
		funcName: "get-stderr",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([handle0]);
	task.exit();
	return handle0;
};
_trampoline11.fnName = "wasi:cli/stderr@0.2.12#getStderr";
const _trampoline12 = function(arg0) {
	_debugLog("[iface=\"wasi:clocks/monotonic-clock@0.2.12\", function=\"subscribe-duration\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "subscribeDuration",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => subscribeDuration(BigInt.asUintN(64, BigInt(arg0))))
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	if (!(ret instanceof Pollable)) throw TypeError("Resource error: Not a valid \"Pollable\" resource.");
	var handle0 = ret[symbolRscHandle];
	if (!handle0) {
		let rep = (ret[symbolRscRep] ?? ++captureCnt0) >>> 0;
		captureTable0.set(rep, ret);
		handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable0, rep);
	}
	_debugLog("[iface=\"wasi:clocks/monotonic-clock@0.2.12\", function=\"subscribe-duration\"][Instruction::Return]", {
		funcName: "subscribe-duration",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([handle0]);
	task.exit();
	return handle0;
};
_trampoline12.fnName = "wasi:clocks/monotonic-clock@0.2.12#subscribeDuration";
let exports1;
let memory0;
let realloc0;
const _trampoline13 = function(arg0, arg1, arg2) {
	var len3 = arg1;
	var base3 = arg0 >>> 0 >>> 0;
	if (base3 < 0 || len3 < 0 || len3 > 67108863 || base3 > memory0.buffer.byteLength || len3 > Math.floor((memory0.buffer.byteLength - base3) / 4)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
	if (base3 % 4 != 0) throw TypeError(`list pointer [${base3}] is not aligned to 4`);
	var result3 = [];
	for (let i = 0; i < len3; i++) {
		let base = base3 + i * 4;
		var handle1 = dataView(_jcoDataViewCacheContext, memory0).getInt32(base + 0, !0);
		var rep2 = handleTable0[(handle1 << 1) + 1] % T_OWN;
		var rsc0 = captureTable0.get(rep2);
		if (!rsc0) {
			rsc0 = Object.create(Pollable.prototype);
			Object.defineProperty(rsc0, symbolRscHandle, {
				writable: !0,
				value: handle1
			});
			Object.defineProperty(rsc0, symbolRscRep, {
				writable: !0,
				value: rep2
			});
		}
		_jcoCurrentBorrowContext.borrows.push(rsc0);
		result3.push(rsc0);
	}
	_debugLog("[iface=\"wasi:io/poll@0.2.12\", function=\"poll\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "poll",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => poll(result3))
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	var val4 = ret;
	var len4 = val4.length;
	var ptr4 = ((...args) => {
		let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
		let previousMayLeave = state.mayLeave;
		let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
		let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
		let previousStorage = thread?.storage;
		thread && (thread.storage = [0, 0]);
		state.mayLeave = !1;
		let restore = () => {
			state.mayLeave = previousMayLeave;
			thread && (thread.storage = previousStorage);
		};
		let result;
		try {
			result = realloc0(...args);
		} catch (err) {
			restore();
			throw err;
		}
		if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
		restore();
		return result;
	})(0, 0, 4, len4 * 4);
	ptr4 >>>= 0;
	if (ptr4 % 4 != 0) throw new WebAssemblyRuntimeError("realloc return: result not aligned");
	if (ptr4 > memory0.buffer.byteLength || len4 > Math.floor((memory0.buffer.byteLength - ptr4) / 4)) throw new WebAssemblyRuntimeError("realloc return: beyond end of memory");
	let valData4;
	let valLenBytes4 = len4 * 4;
	if (Array.isArray(val4)) {
		let offset = 0;
		let dv4 = new DataView(memory0.buffer);
		for (let v of val4) {
			_requireValidNumericPrimitive.bind(null, "u32")(v);
			dv4.setUint32(ptr4 + offset, v, !0);
			offset += 4;
		}
	} else {
		valData4 = new Uint8Array(val4.buffer || val4, val4.byteOffset, valLenBytes4);
		new Uint8Array(memory0.buffer, ptr4, valLenBytes4).set(valData4);
	}
	dataView(_jcoDataViewCacheContext, memory0).setUint32((arg2 >>> 0) + 4, len4, !0);
	dataView(_jcoDataViewCacheContext, memory0).setUint32((arg2 >>> 0) + 0, ptr4, !0);
	_debugLog("[iface=\"wasi:io/poll@0.2.12\", function=\"poll\"][Instruction::Return]", {
		funcName: "poll",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline13.fnName = "wasi:io/poll@0.2.12#poll";
const handleTable1 = [T_FLAG, 0];
handleTable1._createdReps = new Set();
handleTable1._componentIdx = 0;
const captureTable1 = new Map();
let captureCnt1 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable1,
	captures: captureTable1
});
HANDLE_TABLES[1] = handleTable1;
const _trampoline14 = function(arg0, arg1) {
	var handle1 = arg0;
	var rep2 = handleTable3[(handle1 << 1) + 1] % T_OWN;
	var rsc0 = captureTable3.get(rep2);
	if (!rsc0) {
		rsc0 = Object.create(OutputStream.prototype);
		Object.defineProperty(rsc0, symbolRscHandle, {
			writable: !0,
			value: handle1
		});
		Object.defineProperty(rsc0, symbolRscRep, {
			writable: !0,
			value: rep2
		});
	}
	_jcoCurrentBorrowContext.borrows.push(rsc0);
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.check-write\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "checkWrite",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "result-catch-handler",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		let hostRet3 = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => rsc0.checkWrite())
		});
		ret = typeof hostRet3 == "object" && hostRet3 && (hostRet3.tag === "ok" || hostRet3.tag === "err") ? hostRet3 : {
			tag: "ok",
			val: hostRet3
		};
	} catch (e) {
		if (getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(e)) throw e;
		ret = {
			tag: "err",
			val: getErrorPayload(hasOwnProperty, e)
		};
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	var variant6 = ret;
	switch (variant6.tag) {
		case "ok": {
			let e = variant6.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 0, 0, !0);
			dataView(_jcoDataViewCacheContext, memory0).setBigInt64((arg1 >>> 0) + 8, toUint64(_jcoStrictNumericContext, e), !0);
			break;
		}
		case "err": {
			let e = variant6.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 0, 1, !0);
			var variant5 = e;
			switch (variant5.tag) {
				case "last-operation-failed": {
					let e = variant5.val;
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 8, 0, !0);
					if (!(e instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error\" resource.");
					var handle4 = e[symbolRscHandle];
					if (!handle4) {
						let rep = (e[symbolRscRep] ?? ++captureCnt1) >>> 0;
						captureTable1.set(rep, e);
						handle4 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
					}
					dataView(_jcoDataViewCacheContext, memory0).setInt32((arg1 >>> 0) + 12, handle4, !0);
					break;
				}
				case "closed":
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 8, 1, !0);
					break;
				default: throw TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
			}
			break;
		}
		default:
			_debugLog("ERROR: invalid value (expected result as object with 'tag' member)", {
				value: variant6,
				valueType: typeof variant6
			});
			throw TypeError("invalid variant specified for result");
	}
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.check-write\"][Instruction::Return]", {
		funcName: "[method]output-stream.check-write",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline14.fnName = "wasi:io/streams@0.2.12#checkWrite";
const _trampoline15 = function(arg0, arg1, arg2, arg3) {
	var handle1 = arg0;
	var rep2 = handleTable3[(handle1 << 1) + 1] % T_OWN;
	var rsc0 = captureTable3.get(rep2);
	if (!rsc0) {
		rsc0 = Object.create(OutputStream.prototype);
		Object.defineProperty(rsc0, symbolRscHandle, {
			writable: !0,
			value: handle1
		});
		Object.defineProperty(rsc0, symbolRscRep, {
			writable: !0,
			value: rep2
		});
	}
	_jcoCurrentBorrowContext.borrows.push(rsc0);
	var ptr3 = arg1 >>> 0 >>> 0;
	var len3 = arg2;
	if (ptr3 < 0 || len3 < 0 || len3 > 268435455 || ptr3 > memory0.buffer.byteLength || len3 > Math.floor((memory0.buffer.byteLength - ptr3) / 1)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
	if (ptr3 % 1 != 0) throw TypeError(`list pointer [${ptr3}] is not aligned to 1`);
	var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.write\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "write",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "result-catch-handler",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		let hostRet4 = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => rsc0.write(result3))
		});
		ret = typeof hostRet4 == "object" && hostRet4 && (hostRet4.tag === "ok" || hostRet4.tag === "err") ? hostRet4 : {
			tag: "ok",
			val: hostRet4
		};
	} catch (e) {
		if (getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(e)) throw e;
		ret = {
			tag: "err",
			val: getErrorPayload(hasOwnProperty, e)
		};
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	var variant7 = ret;
	switch (variant7.tag) {
		case "ok":
			variant7.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg3 >>> 0) + 0, 0, !0);
			break;
		case "err": {
			let e = variant7.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg3 >>> 0) + 0, 1, !0);
			var variant6 = e;
			switch (variant6.tag) {
				case "last-operation-failed": {
					let e = variant6.val;
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg3 >>> 0) + 4, 0, !0);
					if (!(e instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error\" resource.");
					var handle5 = e[symbolRscHandle];
					if (!handle5) {
						let rep = (e[symbolRscRep] ?? ++captureCnt1) >>> 0;
						captureTable1.set(rep, e);
						handle5 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
					}
					dataView(_jcoDataViewCacheContext, memory0).setInt32((arg3 >>> 0) + 8, handle5, !0);
					break;
				}
				case "closed":
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg3 >>> 0) + 4, 1, !0);
					break;
				default: throw TypeError(`invalid variant tag value \`${JSON.stringify(variant6.tag)}\` (received \`${variant6}\`) specified for \`StreamError\``);
			}
			break;
		}
		default:
			_debugLog("ERROR: invalid value (expected result as object with 'tag' member)", {
				value: variant7,
				valueType: typeof variant7
			});
			throw TypeError("invalid variant specified for result");
	}
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.write\"][Instruction::Return]", {
		funcName: "[method]output-stream.write",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline15.fnName = "wasi:io/streams@0.2.12#write";
const _trampoline16 = function(arg0, arg1) {
	var handle1 = arg0;
	var rep2 = handleTable3[(handle1 << 1) + 1] % T_OWN;
	var rsc0 = captureTable3.get(rep2);
	if (!rsc0) {
		rsc0 = Object.create(OutputStream.prototype);
		Object.defineProperty(rsc0, symbolRscHandle, {
			writable: !0,
			value: handle1
		});
		Object.defineProperty(rsc0, symbolRscRep, {
			writable: !0,
			value: rep2
		});
	}
	_jcoCurrentBorrowContext.borrows.push(rsc0);
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.blocking-flush\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "blockingFlush",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "result-catch-handler",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		let hostRet3 = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => rsc0.blockingFlush())
		});
		ret = typeof hostRet3 == "object" && hostRet3 && (hostRet3.tag === "ok" || hostRet3.tag === "err") ? hostRet3 : {
			tag: "ok",
			val: hostRet3
		};
	} catch (e) {
		if (getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(e)) throw e;
		ret = {
			tag: "err",
			val: getErrorPayload(hasOwnProperty, e)
		};
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	for (let entry of _jcoCurrentBorrowContext.borrows) {
		let rsc = entry.rsc ?? entry;
		entry.drop && rsc[symbolRscHandle] && entry.drop(rsc[symbolRscHandle]);
		rsc[symbolRscHandle] = void 0;
	}
	_jcoCurrentBorrowContext.borrows = [];
	var variant6 = ret;
	switch (variant6.tag) {
		case "ok":
			variant6.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 0, 0, !0);
			break;
		case "err": {
			let e = variant6.val;
			dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 0, 1, !0);
			var variant5 = e;
			switch (variant5.tag) {
				case "last-operation-failed": {
					let e = variant5.val;
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 4, 0, !0);
					if (!(e instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error\" resource.");
					var handle4 = e[symbolRscHandle];
					if (!handle4) {
						let rep = (e[symbolRscRep] ?? ++captureCnt1) >>> 0;
						captureTable1.set(rep, e);
						handle4 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
					}
					dataView(_jcoDataViewCacheContext, memory0).setInt32((arg1 >>> 0) + 8, handle4, !0);
					break;
				}
				case "closed":
					dataView(_jcoDataViewCacheContext, memory0).setInt8((arg1 >>> 0) + 4, 1, !0);
					break;
				default: throw TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
			}
			break;
		}
		default:
			_debugLog("ERROR: invalid value (expected result as object with 'tag' member)", {
				value: variant6,
				valueType: typeof variant6
			});
			throw TypeError("invalid variant specified for result");
	}
	_debugLog("[iface=\"wasi:io/streams@0.2.12\", function=\"[method]output-stream.blocking-flush\"][Instruction::Return]", {
		funcName: "[method]output-stream.blocking-flush",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline16.fnName = "wasi:io/streams@0.2.12#blockingFlush";
const _trampoline17 = function(arg0) {
	_debugLog("[iface=\"wasi:cli/environment@0.2.12\", function=\"get-environment\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getEnvironment",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getEnvironment())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	var vec3 = ret;
	var len3 = vec3.length;
	var result3 = ((...args) => {
		let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
		let previousMayLeave = state.mayLeave;
		let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
		let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
		let previousStorage = thread?.storage;
		thread && (thread.storage = [0, 0]);
		state.mayLeave = !1;
		let restore = () => {
			state.mayLeave = previousMayLeave;
			thread && (thread.storage = previousStorage);
		};
		let result;
		try {
			result = realloc0(...args);
		} catch (err) {
			restore();
			throw err;
		}
		if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
		restore();
		return result;
	})(0, 0, 4, len3 * 16);
	result3 >>>= 0;
	if (result3 % 4 != 0) throw new WebAssemblyRuntimeError("realloc return: result not aligned");
	if (result3 > memory0.buffer.byteLength || len3 > Math.floor((memory0.buffer.byteLength - result3) / 16)) throw new WebAssemblyRuntimeError("realloc return: beyond end of memory");
	if (result3 < 0 || len3 < 0 || len3 > 16777215 || result3 > memory0.buffer.byteLength || len3 > Math.floor((memory0.buffer.byteLength - result3) / 16)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
	for (let i = 0; i < vec3.length; i++) {
		let e = vec3[i];
		let base = result3 + i * 16;
		var [tuple0_0, tuple0_1] = e;
		var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, tuple0_0, ((...args) => {
			let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
			let previousMayLeave = state.mayLeave;
			let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
			let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
			let previousStorage = thread?.storage;
			thread && (thread.storage = [0, 0]);
			state.mayLeave = !1;
			let restore = () => {
				state.mayLeave = previousMayLeave;
				thread && (thread.storage = previousStorage);
			};
			let result;
			try {
				result = realloc0(...args);
			} catch (err) {
				restore();
				throw err;
			}
			if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
			restore();
			return result;
		}), memory0);
		var ptr1 = encodeRes.ptr;
		var len1 = encodeRes.len;
		dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 4, len1, !0);
		dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 0, ptr1, !0);
		var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, tuple0_1, ((...args) => {
			let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
			let previousMayLeave = state.mayLeave;
			let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
			let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
			let previousStorage = thread?.storage;
			thread && (thread.storage = [0, 0]);
			state.mayLeave = !1;
			let restore = () => {
				state.mayLeave = previousMayLeave;
				thread && (thread.storage = previousStorage);
			};
			let result;
			try {
				result = realloc0(...args);
			} catch (err) {
				restore();
				throw err;
			}
			if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
			restore();
			return result;
		}), memory0);
		var ptr2 = encodeRes.ptr;
		var len2 = encodeRes.len;
		dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 12, len2, !0);
		dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 8, ptr2, !0);
	}
	dataView(_jcoDataViewCacheContext, memory0).setUint32((arg0 >>> 0) + 4, len3, !0);
	dataView(_jcoDataViewCacheContext, memory0).setUint32((arg0 >>> 0) + 0, result3, !0);
	_debugLog("[iface=\"wasi:cli/environment@0.2.12\", function=\"get-environment\"][Instruction::Return]", {
		funcName: "get-environment",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline17.fnName = "wasi:cli/environment@0.2.12#getEnvironment";
const handleTable4 = [T_FLAG, 0];
handleTable4._createdReps = new Set();
handleTable4._componentIdx = 0;
const captureTable4 = new Map();
let captureCnt4 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable4,
	captures: captureTable4
});
HANDLE_TABLES[4] = handleTable4;
const _trampoline18 = function(arg0) {
	_debugLog("[iface=\"wasi:cli/terminal-stdin@0.2.12\", function=\"get-terminal-stdin\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getTerminalStdin",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getTerminalStdin())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	var variant1 = ret;
	if (variant1 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 0, !0);
	else {
		let e = variant1;
		dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 1, !0);
		if (!(e instanceof TerminalInput)) throw TypeError("Resource error: Not a valid \"TerminalInput\" resource.");
		var handle0 = e[symbolRscHandle];
		if (!handle0) {
			let rep = (e[symbolRscRep] ?? ++captureCnt4) >>> 0;
			captureTable4.set(rep, e);
			handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable4, rep);
		}
		dataView(_jcoDataViewCacheContext, memory0).setInt32((arg0 >>> 0) + 4, handle0, !0);
	}
	_debugLog("[iface=\"wasi:cli/terminal-stdin@0.2.12\", function=\"get-terminal-stdin\"][Instruction::Return]", {
		funcName: "get-terminal-stdin",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline18.fnName = "wasi:cli/terminal-stdin@0.2.12#getTerminalStdin";
const handleTable5 = [T_FLAG, 0];
handleTable5._createdReps = new Set();
handleTable5._componentIdx = 0;
const captureTable5 = new Map();
let captureCnt5 = 0;
STORE_TRAP.resourceTables.push({
	handles: handleTable5,
	captures: captureTable5
});
HANDLE_TABLES[5] = handleTable5;
const _trampoline19 = function(arg0) {
	_debugLog("[iface=\"wasi:cli/terminal-stdout@0.2.12\", function=\"get-terminal-stdout\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getTerminalStdout",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getTerminalStdout())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	var variant1 = ret;
	if (variant1 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 0, !0);
	else {
		let e = variant1;
		dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 1, !0);
		if (!(e instanceof TerminalOutput)) throw TypeError("Resource error: Not a valid \"TerminalOutput\" resource.");
		var handle0 = e[symbolRscHandle];
		if (!handle0) {
			let rep = (e[symbolRscRep] ?? ++captureCnt5) >>> 0;
			captureTable5.set(rep, e);
			handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable5, rep);
		}
		dataView(_jcoDataViewCacheContext, memory0).setInt32((arg0 >>> 0) + 4, handle0, !0);
	}
	_debugLog("[iface=\"wasi:cli/terminal-stdout@0.2.12\", function=\"get-terminal-stdout\"][Instruction::Return]", {
		funcName: "get-terminal-stdout",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline19.fnName = "wasi:cli/terminal-stdout@0.2.12#getTerminalStdout";
const _trampoline20 = function(arg0) {
	_debugLog("[iface=\"wasi:cli/terminal-stderr@0.2.12\", function=\"get-terminal-stderr\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "getTerminalStderr",
			getCallbackFn: () => null,
			callbackFnName: null,
			errHandling: "none",
			callingWasmExport: !1
		}));
	};
	taskCreation: {
		parentTask = getCurrentTask(_jcoTaskLookupContext, 0, _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0)?.taskID)?.task;
		if (!parentTask) {
			createTask();
			break taskCreation;
		}
		createTask();
		subtask = parentTask.getLatestSubtask();
		if (!subtask) throw Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
		task.setParentSubtask(subtask);
	}
	task.enterSync();
	let ret;
	try {
		ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
			componentIdx: task.componentIdx(),
			taskID: task.id(),
			threadID,
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => getTerminalStderr())
		});
	} catch (err) {
		_debugLog("[Instruction::CallInterface] error during sync call", {
			taskID: task.id(),
			subtaskID: task.getParentSubtask()?.id(),
			err
		});
		getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
		task.setErrored(err);
		task.reject(err);
		task.exit();
		throw err;
	}
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfInterrupted();
	var variant1 = ret;
	if (variant1 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 0, !0);
	else {
		let e = variant1;
		dataView(_jcoDataViewCacheContext, memory0).setInt8((arg0 >>> 0) + 0, 1, !0);
		if (!(e instanceof TerminalOutput)) throw TypeError("Resource error: Not a valid \"TerminalOutput\" resource.");
		var handle0 = e[symbolRscHandle];
		if (!handle0) {
			let rep = (e[symbolRscRep] ?? ++captureCnt5) >>> 0;
			captureTable5.set(rep, e);
			handle0 = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable5, rep);
		}
		dataView(_jcoDataViewCacheContext, memory0).setInt32((arg0 >>> 0) + 4, handle0, !0);
	}
	_debugLog("[iface=\"wasi:cli/terminal-stderr@0.2.12\", function=\"get-terminal-stderr\"][Instruction::Return]", {
		funcName: "get-terminal-stderr",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline20.fnName = "wasi:cli/terminal-stderr@0.2.12#getTerminalStderr";
let exports2;
let postReturn0;
let postReturn1;
let exports1Highlight;
function highlight(arg0, arg1) {
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfTrapped();
	let { task, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
		componentIdx: 0,
		isAsync: !1,
		isManualAsync: !1,
		preserveFutureResult: !1,
		entryFnName: "exports1Highlight",
		getCallbackFn: () => null,
		callbackFnName: null,
		errHandling: "none",
		callingWasmExport: !0
	});
	task.setCalleeIsAsync(!1);
	task.setFuncTypeIsAsync(!1);
	task.setReturnResultTypeIdx(17);
	task.enterSync();
	CURRENT_TASK_MAY_BLOCK.value = +!!task.mayBlock();
	task.setReturnMemoryIdx(0);
	task.setReturnMemory(memory0);
	return _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
		taskID: task.id(),
		threadID,
		componentIdx: task.componentIdx(),
		fn: () => {
			try {
				var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, arg0, ((...args) => {
					let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
					let previousMayLeave = state.mayLeave;
					let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
					let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
					let previousStorage = thread?.storage;
					thread && (thread.storage = [0, 0]);
					state.mayLeave = !1;
					let restore = () => {
						state.mayLeave = previousMayLeave;
						thread && (thread.storage = previousStorage);
					};
					let result;
					try {
						result = realloc0(...args);
					} catch (err) {
						restore();
						throw err;
					}
					if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
					restore();
					return result;
				}), memory0);
				var ptr0 = encodeRes.ptr;
				var len0 = encodeRes.len;
				var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, arg1, ((...args) => {
					let state = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
					let previousMayLeave = state.mayLeave;
					let meta = _getGlobalCurrentThreadMeta(CURRENT_TASK_META, 0);
					let thread = meta && getCurrentThread(_jcoThreadLookupContext, meta.componentIdx, meta.threadID, meta.taskID)?.thread;
					let previousStorage = thread?.storage;
					thread && (thread.storage = [0, 0]);
					state.mayLeave = !1;
					let restore = () => {
						state.mayLeave = previousMayLeave;
						thread && (thread.storage = previousStorage);
					};
					let result;
					try {
						result = realloc0(...args);
					} catch (err) {
						restore();
						throw err;
					}
					if (result && typeof result.then == "function") return Promise.resolve(result).finally(restore);
					restore();
					return result;
				}), memory0);
				var ptr1 = encodeRes.ptr;
				var len1 = encodeRes.len;
				_debugLog("[iface=\"highlight\", function=\"highlight\"][Instruction::CallWasm] enter", {
					funcName: "highlight",
					paramCount: 4,
					async: !1,
					postReturn: !0
				});
				let ret;
				try {
					ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
						taskID: task.id(),
						threadID,
						componentIdx: task.componentIdx(),
						fn: () => exports1Highlight(ptr0, len0, ptr1, len1)
					});
				} catch (err) {
					_debugLog("[Instruction::CallWasm] error during sync call", {
						taskID: task.id(),
						err
					});
					getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
					task.setErrored(err);
					task.reject(err);
					task.exit();
					throw err;
				}
				task.endFirstSlice();
				let variant3;
				switch (dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 0, !0)) {
					case 0:
						variant3 = void 0;
						break;
					case 1:
						var ptr2 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 4, !0) >>> 0;
						var len2 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 8, !0) >>> 0;
						if (ptr2 > memory0.buffer.byteLength || len2 > Math.floor((memory0.buffer.byteLength - ptr2) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
						variant3 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr2, len2));
						break;
					default: throw TypeError("invalid variant discriminant for option");
				}
				_debugLog("[iface=\"highlight\", function=\"highlight\"][Instruction::Return]", {
					funcName: "highlight",
					paramCount: 1,
					async: !1,
					postReturn: !0
				});
				task.resolve([{ html: variant3 }]);
				let retCopy = { html: variant3 };
				let cstate = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
				cstate.mayLeave = !1;
				try {
					postReturn0(ret);
				} catch (err) {
					err = _postReturnTrap(_jcoComponentPostReturnTrapContext, 0, err);
					task.reject(err);
					throw err;
				}
				cstate.mayLeave = !0;
				task.exit();
				return retCopy;
			} catch (err) {
				if (!task.isResolvedState()) {
					task.setErrored(err);
					task.reject(err);
				}
				task.isExited() || task.exit({ skipExclusiveLockCheck: !0 });
				throw err;
			}
		}
	});
}
let exports1Languages;
function languages() {
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfTrapped();
	let { task, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
		componentIdx: 0,
		isAsync: !1,
		isManualAsync: !1,
		preserveFutureResult: !1,
		entryFnName: "exports1Languages",
		getCallbackFn: () => null,
		callbackFnName: null,
		errHandling: "none",
		callingWasmExport: !0
	});
	task.setCalleeIsAsync(!1);
	task.setFuncTypeIsAsync(!1);
	task.setReturnResultTypeIdx(18);
	task.enterSync();
	CURRENT_TASK_MAY_BLOCK.value = +!!task.mayBlock();
	task.setReturnMemoryIdx(0);
	task.setReturnMemory(memory0);
	return _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
		taskID: task.id(),
		threadID,
		componentIdx: task.componentIdx(),
		fn: () => {
			try {
				_debugLog("[iface=\"languages\", function=\"languages\"][Instruction::CallWasm] enter", {
					funcName: "languages",
					paramCount: 0,
					async: !1,
					postReturn: !0
				});
				let ret;
				try {
					ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
						taskID: task.id(),
						threadID,
						componentIdx: task.componentIdx(),
						fn: () => exports1Languages()
					});
				} catch (err) {
					_debugLog("[Instruction::CallWasm] error during sync call", {
						taskID: task.id(),
						err
					});
					getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).markTrapped(err);
					task.setErrored(err);
					task.reject(err);
					task.exit();
					throw err;
				}
				task.endFirstSlice();
				var len1 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 4, !0);
				var base1 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 0, !0) >>> 0;
				if (base1 < 0 || len1 < 0 || len1 > 33554431 || base1 > memory0.buffer.byteLength || len1 > Math.floor((memory0.buffer.byteLength - base1) / 8)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
				if (base1 % 4 != 0) throw TypeError(`list pointer [${base1}] is not aligned to 4`);
				var result1 = [];
				for (let i = 0; i < len1; i++) {
					let base = base1 + i * 8;
					var ptr0 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 0, !0) >>> 0;
					var len0 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 4, !0) >>> 0;
					if (ptr0 > memory0.buffer.byteLength || len0 > Math.floor((memory0.buffer.byteLength - ptr0) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result0 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr0, len0));
					result1.push(result0);
				}
				_debugLog("[iface=\"languages\", function=\"languages\"][Instruction::Return]", {
					funcName: "languages",
					paramCount: 1,
					async: !1,
					postReturn: !0
				});
				task.resolve([result1]);
				let retCopy = result1;
				let cstate = getOrCreateAsyncState(_jcoComponentStateLookupContext, 0);
				cstate.mayLeave = !1;
				try {
					postReturn1(ret);
				} catch (err) {
					err = _postReturnTrap(_jcoComponentPostReturnTrapContext, 0, err);
					task.reject(err);
					throw err;
				}
				cstate.mayLeave = !0;
				task.exit();
				return retCopy;
			} catch (err) {
				if (!task.isResolvedState()) {
					task.setErrored(err);
					task.reject(err);
				}
				task.isExited() || task.exit({ skipExclusiveLockCheck: !0 });
				throw err;
			}
		}
	});
}
function trampoline0(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable1, handle);
	if (handleEntry.own) {
		let rsc = captureTable1.get(handleEntry.rep);
		if (rsc) {
			captureTable1.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else Error$1[symbolCabiDispose] && Error$1[symbolCabiDispose](handleEntry.rep);
	}
}
function trampoline1(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable0, handle);
	if (handleEntry.own) {
		let rsc = captureTable0.get(handleEntry.rep);
		if (rsc) {
			captureTable0.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else Pollable[symbolCabiDispose] && Pollable[symbolCabiDispose](handleEntry.rep);
	}
}
function trampoline2(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable2, handle);
	if (handleEntry.own) {
		let rsc = captureTable2.get(handleEntry.rep);
		if (rsc) {
			captureTable2.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else InputStream[symbolCabiDispose] && InputStream[symbolCabiDispose](handleEntry.rep);
	}
}
function trampoline3(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable3, handle);
	if (handleEntry.own) {
		let rsc = captureTable3.get(handleEntry.rep);
		if (rsc) {
			captureTable3.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else OutputStream[symbolCabiDispose] && OutputStream[symbolCabiDispose](handleEntry.rep);
	}
}
function trampoline4(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable4, handle);
	if (handleEntry.own) {
		let rsc = captureTable4.get(handleEntry.rep);
		if (rsc) {
			captureTable4.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else TerminalInput[symbolCabiDispose] && TerminalInput[symbolCabiDispose](handleEntry.rep);
	}
}
function trampoline5(handle) {
	let handleEntry = rscTableRemove(_jcoResourceRemoveContext, handleTable5, handle);
	if (handleEntry.own) {
		let rsc = captureTable5.get(handleEntry.rep);
		if (rsc) {
			captureTable5.delete(handleEntry.rep);
			STORE_TRAP.disposed.add(rsc);
			rsc[symbolDispose] && rsc[symbolDispose]();
		} else TerminalOutput[symbolCabiDispose] && TerminalOutput[symbolCabiDispose](handleEntry.rep);
	}
}
let trampoline6 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 6,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline6.manuallyAsync,
	paramLiftFns: [_liftFlatResult(_jcoLiftVariantContext, {
		caseMetas: [[
			"ok",
			null,
			0,
			0,
			0,
			[]
		], [
			"err",
			null,
			0,
			0,
			0,
			[]
		]],
		variantSize32: 1,
		variantAlign32: 1,
		variantPayloadOffset32: 1,
		variantFlatCount: 1,
		variantPayloadFlatTypes: []
	})],
	resultLowerFns: [],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline6
});
let trampoline7 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 7,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline7.manuallyAsync,
	paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
	resultLowerFns: [],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline7
});
let trampoline8 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 8,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline8.manuallyAsync,
	paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
	resultLowerFns: [_lowerFlatOwn(_jcoStrictNumericContext, {
		componentIdx: 0,
		tableIdx: 0,
		lowerFn: function lowerImportedOwnedHost_Pollable(obj) {
			if (!(obj instanceof Pollable)) throw TypeError("Resource error: Not a valid \"Pollable\" resource.");
			let handle = obj[symbolRscHandle];
			if (!handle) {
				let rep = (obj[symbolRscRep] ?? ++captureCnt0) >>> 0;
				captureTable0.set(rep, obj);
				handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable0, rep);
			}
			return handle;
		}
	})],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline8
});
let trampoline9 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 9,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline9.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOwn(_jcoStrictNumericContext, {
		componentIdx: 0,
		tableIdx: 2,
		lowerFn: function lowerImportedOwnedHost_InputStream(obj) {
			if (!(obj instanceof InputStream)) throw TypeError("Resource error: Not a valid \"InputStream\" resource.");
			let handle = obj[symbolRscHandle];
			if (!handle) {
				let rep = (obj[symbolRscRep] ?? ++captureCnt2) >>> 0;
				captureTable2.set(rep, obj);
				handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable2, rep);
			}
			return handle;
		}
	})],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline9
});
let trampoline10 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 10,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline10.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOwn(_jcoStrictNumericContext, {
		componentIdx: 0,
		tableIdx: 3,
		lowerFn: function lowerImportedOwnedHost_OutputStream(obj) {
			if (!(obj instanceof OutputStream)) throw TypeError("Resource error: Not a valid \"OutputStream\" resource.");
			let handle = obj[symbolRscHandle];
			if (!handle) {
				let rep = (obj[symbolRscRep] ?? ++captureCnt3) >>> 0;
				captureTable3.set(rep, obj);
				handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable3, rep);
			}
			return handle;
		}
	})],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline10
});
let trampoline11 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 11,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline11.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOwn(_jcoStrictNumericContext, {
		componentIdx: 0,
		tableIdx: 3,
		lowerFn: function lowerImportedOwnedHost_OutputStream(obj) {
			if (!(obj instanceof OutputStream)) throw TypeError("Resource error: Not a valid \"OutputStream\" resource.");
			let handle = obj[symbolRscHandle];
			if (!handle) {
				let rep = (obj[symbolRscRep] ?? ++captureCnt3) >>> 0;
				captureTable3.set(rep, obj);
				handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable3, rep);
			}
			return handle;
		}
	})],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline11
});
let trampoline12 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 12,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline12.manuallyAsync,
	paramLiftFns: [_liftFlatU64],
	resultLowerFns: [_lowerFlatOwn(_jcoStrictNumericContext, {
		componentIdx: 0,
		tableIdx: 0,
		lowerFn: function lowerImportedOwnedHost_Pollable(obj) {
			if (!(obj instanceof Pollable)) throw TypeError("Resource error: Not a valid \"Pollable\" resource.");
			let handle = obj[symbolRscHandle];
			if (!handle) {
				let rep = (obj[symbolRscRep] ?? ++captureCnt0) >>> 0;
				captureTable0.set(rep, obj);
				handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable0, rep);
			}
			return handle;
		}
	})],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline12
});
let trampoline13 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 13,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline13.manuallyAsync,
	paramLiftFns: [_liftFlatList(_jcoLiftListContext, {
		elemLiftFn: _liftFlatBorrow.bind(null, 0),
		elemAlign32: 4,
		elemSize32: 4,
		typedArray: void 0
	})],
	resultLowerFns: [_lowerFlatList(_jcoLowerListContext, {
		elemLowerFn: _lowerFlatU32.bind(void 0, _jcoStrictNumericContext),
		elemSize32: 4,
		elemAlign32: 4,
		typedArray: Uint32Array
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: () => realloc0,
	importFn: _trampoline13
});
let trampoline14 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 14,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline14.manuallyAsync,
	paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
	resultLowerFns: [_lowerFlatResult(_jcoStrictNumericContext, {
		caseMetas: [[
			"ok",
			_lowerFlatU64.bind(void 0, _jcoStrictNumericContext),
			16,
			8,
			8
		], [
			"err",
			_lowerFlatVariant(_jcoStrictNumericContext, {
				caseMetas: [[
					"last-operation-failed",
					_lowerFlatOwn(_jcoStrictNumericContext, {
						componentIdx: 0,
						tableIdx: 1,
						lowerFn: function lowerImportedOwnedHost_Error$1(obj) {
							if (!(obj instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error$1\" resource.");
							let handle = obj[symbolRscHandle];
							if (!handle) {
								let rep = (obj[symbolRscRep] ?? ++captureCnt1) >>> 0;
								captureTable1.set(rep, obj);
								handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
							}
							return handle;
						}
					}),
					4,
					4,
					1
				], [
					"closed",
					null,
					0,
					0,
					0
				]],
				variantSize32: 8,
				variantAlign32: 4,
				variantPayloadOffset32: 4,
				variantFlatCount: 2
			}),
			16,
			8,
			8
		]],
		variantSize32: 16,
		variantAlign32: 8,
		variantPayloadOffset32: 8,
		variantFlatCount: 3
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline14
});
let trampoline15 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 15,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline15.manuallyAsync,
	paramLiftFns: [_liftFlatBorrow.bind(null, 3), _liftFlatList(_jcoLiftListContext, {
		elemLiftFn: _liftFlatU8,
		elemAlign32: 1,
		elemSize32: 1,
		typedArray: Uint8Array
	})],
	resultLowerFns: [_lowerFlatResult(_jcoStrictNumericContext, {
		caseMetas: [[
			"ok",
			null,
			12,
			4,
			4
		], [
			"err",
			_lowerFlatVariant(_jcoStrictNumericContext, {
				caseMetas: [[
					"last-operation-failed",
					_lowerFlatOwn(_jcoStrictNumericContext, {
						componentIdx: 0,
						tableIdx: 1,
						lowerFn: function lowerImportedOwnedHost_Error$1(obj) {
							if (!(obj instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error$1\" resource.");
							let handle = obj[symbolRscHandle];
							if (!handle) {
								let rep = (obj[symbolRscRep] ?? ++captureCnt1) >>> 0;
								captureTable1.set(rep, obj);
								handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
							}
							return handle;
						}
					}),
					4,
					4,
					1
				], [
					"closed",
					null,
					0,
					0,
					0
				]],
				variantSize32: 8,
				variantAlign32: 4,
				variantPayloadOffset32: 4,
				variantFlatCount: 2
			}),
			12,
			4,
			4
		]],
		variantSize32: 12,
		variantAlign32: 4,
		variantPayloadOffset32: 4,
		variantFlatCount: 3
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline15
});
let trampoline16 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 16,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline16.manuallyAsync,
	paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
	resultLowerFns: [_lowerFlatResult(_jcoStrictNumericContext, {
		caseMetas: [[
			"ok",
			null,
			12,
			4,
			4
		], [
			"err",
			_lowerFlatVariant(_jcoStrictNumericContext, {
				caseMetas: [[
					"last-operation-failed",
					_lowerFlatOwn(_jcoStrictNumericContext, {
						componentIdx: 0,
						tableIdx: 1,
						lowerFn: function lowerImportedOwnedHost_Error$1(obj) {
							if (!(obj instanceof Error$1)) throw TypeError("Resource error: Not a valid \"Error$1\" resource.");
							let handle = obj[symbolRscHandle];
							if (!handle) {
								let rep = (obj[symbolRscRep] ?? ++captureCnt1) >>> 0;
								captureTable1.set(rep, obj);
								handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable1, rep);
							}
							return handle;
						}
					}),
					4,
					4,
					1
				], [
					"closed",
					null,
					0,
					0,
					0
				]],
				variantSize32: 8,
				variantAlign32: 4,
				variantPayloadOffset32: 4,
				variantFlatCount: 2
			}),
			12,
			4,
			4
		]],
		variantSize32: 12,
		variantAlign32: 4,
		variantPayloadOffset32: 4,
		variantFlatCount: 3
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline16
});
let trampoline17 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 17,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline17.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatList(_jcoLowerListContext, {
		elemLowerFn: _lowerFlatTuple({
			elemLowerMetas: [[
				_lowerFlatStringAny.bind(void 0, _jcoLowerStringContext),
				8,
				4
			], [
				_lowerFlatStringAny.bind(void 0, _jcoLowerStringContext),
				8,
				4
			]],
			size32: 16,
			align32: 4
		}),
		elemSize32: 16,
		elemAlign32: 4,
		typedArray: void 0
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: () => realloc0,
	importFn: _trampoline17
});
let trampoline18 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 18,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline18.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOption(_jcoStrictNumericContext, {
		caseMetas: [[
			"none",
			null,
			0,
			0,
			0
		], [
			"some",
			_lowerFlatOwn(_jcoStrictNumericContext, {
				componentIdx: 0,
				tableIdx: 4,
				lowerFn: function lowerImportedOwnedHost_TerminalInput(obj) {
					if (!(obj instanceof TerminalInput)) throw TypeError("Resource error: Not a valid \"TerminalInput\" resource.");
					let handle = obj[symbolRscHandle];
					if (!handle) {
						let rep = (obj[symbolRscRep] ?? ++captureCnt4) >>> 0;
						captureTable4.set(rep, obj);
						handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable4, rep);
					}
					return handle;
				}
			}),
			4,
			4,
			1
		]],
		variantSize32: 8,
		variantAlign32: 4,
		variantPayloadOffset32: 4,
		variantFlatCount: 2,
		payloadMaybeNull: !1
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline18
});
let trampoline19 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 19,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline19.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOption(_jcoStrictNumericContext, {
		caseMetas: [[
			"none",
			null,
			0,
			0,
			0
		], [
			"some",
			_lowerFlatOwn(_jcoStrictNumericContext, {
				componentIdx: 0,
				tableIdx: 5,
				lowerFn: function lowerImportedOwnedHost_TerminalOutput(obj) {
					if (!(obj instanceof TerminalOutput)) throw TypeError("Resource error: Not a valid \"TerminalOutput\" resource.");
					let handle = obj[symbolRscHandle];
					if (!handle) {
						let rep = (obj[symbolRscRep] ?? ++captureCnt5) >>> 0;
						captureTable5.set(rep, obj);
						handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable5, rep);
					}
					return handle;
				}
			}),
			4,
			4,
			1
		]],
		variantSize32: 8,
		variantAlign32: 4,
		variantPayloadOffset32: 4,
		variantFlatCount: 2,
		payloadMaybeNull: !1
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline19
});
let trampoline20 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 20,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline20.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatOption(_jcoStrictNumericContext, {
		caseMetas: [[
			"none",
			null,
			0,
			0,
			0
		], [
			"some",
			_lowerFlatOwn(_jcoStrictNumericContext, {
				componentIdx: 0,
				tableIdx: 5,
				lowerFn: function lowerImportedOwnedHost_TerminalOutput(obj) {
					if (!(obj instanceof TerminalOutput)) throw TypeError("Resource error: Not a valid \"TerminalOutput\" resource.");
					let handle = obj[symbolRscHandle];
					if (!handle) {
						let rep = (obj[symbolRscRep] ?? ++captureCnt5) >>> 0;
						captureTable5.set(rep, obj);
						handle = rscTableCreateOwn(HANDLE_INDEX_SPACES, handleTable5, rep);
					}
					return handle;
				}
			}),
			4,
			4,
			1
		]],
		variantSize32: 8,
		variantAlign32: 4,
		variantPayloadOffset32: 4,
		variantFlatCount: 2,
		payloadMaybeNull: !1
	})],
	hasResultPointer: !0,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: 0,
	stringEncoding: "utf8",
	getMemoryFn: () => memory0,
	getReallocFn: void 0,
	importFn: _trampoline20
});
await (() => {
	let gen = (function* _initGenerator() {
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABdhFgAn9/AGAEf39/fwBgA39/fwF/YAF/AX9gAn9/AX9gBn9/f39/fwF/YAF/AGADf39/AGAAAX9gAX4Bf2AAAGAFf39/f38AYAd/f39/f39/AGAGf39/f39/AGAEf39/fwF/YAh/f39/f39/fwBgBX9/f39/AX8C7AcVE3dhc2k6aW8vZXJyb3JAMC4yLjAUW3Jlc291cmNlLWRyb3BdZXJyb3IABhJ3YXNpOmlvL3BvbGxAMC4yLjAXW3Jlc291cmNlLWRyb3BdcG9sbGFibGUABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAYVd2FzaTppby9zdHJlYW1zQDAuMi4wHFtyZXNvdXJjZS1kcm9wXW91dHB1dC1zdHJlYW0ABh13YXNpOmNsaS90ZXJtaW5hbC1pbnB1dEAwLjIuMB1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAGHndhc2k6Y2xpL3Rlcm1pbmFsLW91dHB1dEAwLjIuMB5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQABhp3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMA9nZXQtZW52aXJvbm1lbnQABhN3YXNpOmNsaS9leGl0QDAuMi4wBGV4aXQABhJ3YXNpOmlvL3BvbGxAMC4yLjAWW21ldGhvZF1wb2xsYWJsZS5ibG9jawAGEndhc2k6aW8vcG9sbEAwLjIuMARwb2xsAAcVd2FzaTppby9zdHJlYW1zQDAuMi4wIVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQAAFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUAARV3YXNpOmlvL3N0cmVhbXNAMC4yLjAkW21ldGhvZF1vdXRwdXQtc3RyZWFtLmJsb2NraW5nLWZsdXNoAAAVd2FzaTppby9zdHJlYW1zQDAuMi4wH1ttZXRob2Rdb3V0cHV0LXN0cmVhbS5zdWJzY3JpYmUAAxR3YXNpOmNsaS9zdGRpbkAwLjIuMAlnZXQtc3RkaW4ACBV3YXNpOmNsaS9zdGRvdXRAMC4yLjAKZ2V0LXN0ZG91dAAIFXdhc2k6Y2xpL3N0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AAAiBiACIAQgB09qIgotAAAiByAGIAdJIgQbOgABIAEgDCAAIANPayIMLQAAIgIgCCAAIANJayIILQAAIgAgAiAASxs6AAYgASAFIARqIgUtAAAiBCAKIAYgB09qIgotAAAiByAEIAdJIgYbOgACIAEgDCACIABPayIMLQAAIgMgCCACIABJayIILQAAIgAgAyAASxs6AAUgASAFIAZqIgUtAAAiBiAKIAQgB09qIgQtAAAiByAGIAdJIgobOgADIAEgDCADIABPayIMLQAAIgIgCCADIABJayIDLQAAIgAgAiAASxs6AAQCQAJAIAQgBiAHT2ogAyACIABJa0EBakcNACAFIApqIAwgAiAAT2tBAWpGDQELENWCgIAAAAsLxhYBD38jgICAgABBEGsiBySAgICAAAJAAkACQAJAIAFBIUkNACACQX9qIQgCQANAAkACQCAERQ0AIABBf2ohCSABIQoDQCAAIApBA3YiC0EHbGohDCAAIAtBAnRqIQ0CQAJAIApBwABJDQAgACANIAwgCxDAgICAACEODAELIAAgDCANIAAtAAAiCyANLQAAIgFJIg8gASAMLQAAIhBJcxsgDyALIBBJcxshDgsgBEF/aiEEIAcgDi0AACILOgAPIA4gAGshEQJAIAVFDQAgBS0AACALQf8BcU8NAwsgAyAKSQ0IQQAhASALQf8BcSENIAAhDCACIApqIhIhCyARIRMDQAJAIAwgAEEAIBNBfWoiDyAPIBNLG2oiFE8NAANAIAIgC0F/aiAMLQAAIg8gDUkiEBsgAWogDzoAACACIAtBfmogDEEBai0AACIPIA1JIhUbIAEgEGoiAWogDzoAACACIAtBfWogDEECai0AACIPIA1JIhAbIAEgFWoiAWogDzoAACACIAtBfGoiCyAMQQNqLQAAIg8gDUkiFRsgASAQaiIBaiAPOgAAIAEgFWohASAMQQRqIgwgFEkNAAsLAkAgDCAAIBNqIg9PDQAgEyAMayEQIAwgAGohFQJAAkAgDyAMa0EBcQ0AIAwhDwwBCyACIAtBf2oiCyAMLQAAIg8gDUkiFBsgAWogDzoAACAMQQFqIQ8gASAUaiEBCyAVIBBqIRQCQCAJIBNqIAxGDQADQCACIAtBf2ogDy0AACIMIA1JIhAbIAFqIAw6AAAgAiALQX5qIgsgD0EBai0AACIMIA1J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QAJAAkACQCAKQV5qDh0EAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAwALAkACQCAKQYABSSIPRQ0AQQEhDQwBCwJAIApBgBBPDQBBAiENDAELQQNBBCAKQYCABEkbIQ0LAkAgDSADKAIgIAJrTQ0AIANBIGogAiANQQFBARCXgICAAAsgAygCJCILIAJqIQ4gDw0EIApBP3FBgH9yIQ8gCkEGdiEQAkAgCkGAEE8NACAOIA86AAEgDiAQQcABcjoAACANIAJqIQIMBgsgCkEMdiERIBBBP3FBgH9yIRACQCAKQf//A0sNACAOIA86AAIgDiAQOgABIA4gEUHgAXI6AAAgDSACaiECDAYLIA4gDzoAAyAOIBA6AAIgDiARQT9xQYB/cjoAASAOIApBEnZBcHI6AAAgDSACaiECDAULAkAgAygCICACa0EESw0AIANBIGogAkEFQQFBARCXgICAACADKAIoIQILIAMoAiQiCyACaiIKI4GAgIAAQb+XwIAAaiINKAAANgAAIAogDS0ABDoABCACQQVqIQIMBAsCQCADKAIgIAJrQQNLDQAgA0EgaiACQQRBAUEBEJeAgIAAIAMoAighAgsgAygCJCILIAJqQabY0dsDNgAAIAJBBGohAgwDCwJAIAMoAiAgAmtBA0sNACADQSBqIAJBBEEBQQEQl4CAgAAgAygCJCELIAMoAighAgsgCyACakGmztHbAzYAACACQQRqIQIMAgsCQCADKAIgIAJrQQVLDQAgA0EgaiACQQZBAUEBEJeAgIAAIAMoAiQhCyADKAIoIQILIAsgAmoiCiOBgICAAEHEl8CAAGoiDS8ABDsABCAKIA0oAAA2AAAgAkEGaiECDAELIA4gCjoAACANIAJqIQILIAMgAjYCKCAIIAxHDQALIAMoAiQhCyADKAIgIQgCQCACIAMoAgwgAygCFCIKa00NACADQQxqIAogAkEBQQEQl4CAgAAgAygCFCEKCwJAIAJFDQAgAygCECAKaiALIAL8CgAACyADIAogAmo2AhQgCEUNACALIAhBARDugICAAAsgAUEYaiIBIAVHDQALIAdBAXFFDQECQCADKAIMIAMoAhQiAmtBBksNACADQQxqIAJBB0EBQQEQl4CAgAAgAygCFCECCyADKAIQIAJqIggjgYCAgABBjZnAgABqIgooAAA2AAAg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IQILIAEgAjoACyABIAAoAgg2AgwgASAAKAIAIAAoAgQQqYGAgAAgASABKQMANwIQI4GAgIAAQfD1wIAAai0AACEAIAEgAUELajYCICABIAFBEGo2AhwgASABQQxqNgIYAkACQAJAIABFDQAjgYCAgAAiAEHw9cCAAGpBAToAACAAQdD1wIAAaiICKAIAIQAgAkEANgIAIAANAQsgAUEYaiABQS9qI4GAgIAAQbjwwIAAahCVgYCAAAwBCyOBgICAACECIAFBGGogAEEIahCkgYCAACIDQQRqIAJB4PDAgABqEJWBgIAAIANBADoAACACQfD1wIAAakEBOgAAIAJB0PXAgABqIgMoAgAhAiADIAA2AgAgASACNgIoIAFBATYCJCACRQ0AIAIgAigCACIAQX9qNgIAIABBAUcNACABQSRqQQRqEKWBgIAACyABQTBqJICAgIAAC24BAX8jgICAgABBIGsiAiSAgICAACACIAAgARCAgYCAADYCBCACI4uAgIAArUIghiACQQRqrYQ3AxAgAkEIaiACQR9qI4GAgIAAQcSUwIAAaiACQRBqEJqBgIAAIAJBCGoQg4GAgAAQlIGAgAAAC7kBAQF/I4CAgIAAQRBrIgQkgICAgAAgAEH/AToAACAEIAE2AgggBCAAKQIANwMAIAQjgYCAgABBzO7AgABqIAIgAxCygoCAACEBIAQtAAAhAwJAAkACQCABRQ0AIANB/wFxQf8BRw0BI4GAgIAAIgRB35nAgABqQa0BIARBpO7AgABqELOCgIAAAAsgA0H/AXFBA0cNASAEQQRyENmCgIAADAELIAAgBCkDADcCAAsgBEEQaiSAgICAAAtxAQF/I4CAgIAAQRBrIgIkgICAgAACQAJAAkAgAUEISw0AIAEgAE0NAQsgAkEANgIMIAJBDGogAUEEIAFBBEsbIAAQmYKAgAAhAUEAIAIoAgwgARshAQwBCyAAEJGCgIAAIQELIAJBEGokgICAgAAgAQsJABCUgYCAAAALCgAgABCUgoCAAAudAQECfyOAgICAAEEQayIEJICAgIAAAkACQAJAIAJBCEsNACACIANNDQELQQAhBSAEQQA2AgwgBEEMaiACQQQgAkEESxsgAxCZgoCAAA0BIAQoAgwiAkUNAQJAIAMgASADIAFJGyIDRQ0AIAIgACAD/AoAAAsgABCUgoCAACACIQUMAQsgACADEJeCgIAAIQULIARBEGokgICAgAAgBQs4AgF/AX4jgICAgABBEGsiASSAgICAACAAKQIAIQIgASAANgIMIAEgAjcCBCABQQRqEIqBgIAAAAsNACABIAAQoYGAgAAACy8BAX8jgICAgABBEGsiAiSAgICAACACIAE2AgwgAiAANgIIIAJBCGoQiIGAgAAAC+8BAgN/AX4jgICAgABBEGsiAiSAgICAACABKAIEIQMgASgCACEEIAAtAAAhACACQQRqEKaBgIAAIAIpAgghBQJAIAIoAgQiAUF/Rw0AIAVC/wGDQgNSDQAgAkEMahDZgoCAAAsCQAJAAkACQCAEI4GAgIAAQeOdwIAAakERIAMoAgwiAxGCgICAAICAgIAADQAgAEEBcQ0BIAQjgYCAgABB9J3AgABqQdgAIAMRgoCAgACAgICAAEUNAQtBASEEIAFBAEoNAQwCC0EAIQQgAUEATA0BCyAFpyABQQEQ7oCAgAALIAJBEGokgICAgAAgBAvxAgECfyOAgICAAEGgA2siAySAgICAAAJAAkACQAJAIAJB/wJLDQACQCACRQ0AIANBFGogASAC/AoAAAsgA0EUaiACakEAOgAAIANBlANqIANBFGogAkEBahC9goCAAAJAIAMoApQDQQFHDQBBfiECIANBfjYCCCADI4GAgIAAQfDuwIAAaikDADcCDAwCCwJAIAMoApgDEISCgIAAIgFFDQACQAJAIAEQjoKAgAAiAg0AQQEhBAwBCxDwgICAACACQQEQ7YCAgAAiBEUNBCACRQ0AIAQgASAC/AoAAAsgAyACNgIQIAMgBDYCDCADIAI2AggMAgtBfyECIANBfzYCCAwBCyADQQhqIAEgAhCOgYCAACADKAIIIQILAkAgAkF+Rg0AIAAgAykCDDcCBCAAIAI2AgAMAgsCQCADLQAMQQNHDQAgA0EQahDZgoCAAAsgAEF/NgIADAELQQEgAhCegoCAAAALIANBoANqJICAgIAAC3IBAn8jgICAgABBEGsiASSAgICAACAALQAAIQIgAEEBOgAAIAEgAjoADwJAIAJBAUcNACOBgICAACEAQQAgAUEPaiOOgICAACAAQb+cwIAAakHBACAAQfTvwIAAahCBgYCAAAALIAFBEGokgICAgAAgAAtXAQF/AkAgACgCACIAQQxqKAIAIgFFDQAgAEEQaigCACABQQEQ7oCAgAALAkAgAEF/Rg0AIAAgACgCBCIBQX9qNgIEIAFBAUcNACAAQRhBBBDugICAAAsLiwMBBn8jgICAgABBEGsiASSAgICAABDwgICAAEGABCECAkACQAJAAkBBgARBARDtgICAACIDRQ0AIAEgAzYCCCABQYAENgIEAkACQCADQYAEEN6BgIAADQBBgAQhAgNAI4GAgIAAIQQjkICAgAAoAgAhBSORgICAACgCACEGAkAgBSAEQdjvwIAAakYNACOBgICAAEHY78CAAGoQ14KAgAALIAZBxABHDQIgASACNgIMIAFBBGogAkEBQQFBARCNgYCAACABKAIIIgMgASgCBCICEN6BgIAARQ0ACwsgASADEI6CgIAAIgY2AgwgAiAGTQ0DAkAgBg0AQQEhBCADIAJBARDugICAAAwDCyADIAJBASAGEO+AgIAAIgQNAkEBIAYQnoKAgAAACyAAQX82AgAgACAGrUIghjcCBCACRQ0DIAMgAkEBEO6AgIAADAMLQQFBgAQQnoKAgAAACyABIAY2AgQgASAENgIICyAAIAEoAgw2AgggACABKQIENwIACyABQRBqJICAgIAAC6QCAQV/I4CAgIAAQRBrIgAkgICAgABBAyEBAkAjgYCAgABB4PXAgABqLQAAQX9qIgJB/wFxQQNJDQAgAEEEaiOBgICAAEGxnMCAAGpBDhCjgYCAAAJAAkAgACgCBCIDQX9HDQBBAiECDAELAkACQAJAAkAgACgCDEF/ag4EAAICAQILIAAoAggiBC0AAEEwRw0BQQMhAUECIQIgAw0CDAMLIAAoAggiBCgAAEHm6rHjBkcNAEECIQFBASECIAMNAQwCC0EBIQFBACECIANFDQEgACgCCCEECyAEIANBARDugICAAAsjgYCAgABB4PXAgABqIgMgAy0AACIDIAEgAxs6AAAgA0UNACADQX9qQX8gA0EESRshAgsgAEEQaiSAgICAACACCwkAEN2BgIAAAAvyAQIDfwJ+I4CAgIAAQRBrIgMkgICAgAAgAyABIAIoAgwiBBGAgICAAICAgIAAQQQhAiABIQUCQAJAIAMpAwBC3Oyn/8XbgPu5f4UgAykDCELxg8Pjpr7Y4CSFhFANACADIAEgBBGAgICAAICAgIAAIAMpAwghBiADKQMAIQcjgYCAgAAhAgJAIAdCj86Yi6+0hYKKf4UgBkLMzs7v787A7/EAhYRCAFENACACQaqdwIAAaiEBQQwhAgwCCyABQQRqIQVBCCECCyABIAJqKAIAIQIgBSgCACEBCyAAIAI2AgQgACABNgIAIANBEGokgICAgAAL2gIBBX8jgICAgABBEGsiBCSAgICAAAJAAkAgA0UNACAEQQxqIQUDQAJAAkACQAJAAkBBAiACIAMQ2YGAgAAiBkF/Rw0AI4GAgIAAIQcjkICAgAAoAgAhCCORgICAACgCACEGAkAgCCAHQdjvwIAAakYNACOBgICAAEHY78CAAGoQ14KAgAALIARBADoACyAEQQA7AAkgBCAGNgIMIARBADoACCAGEM6CgIAAKAIIEYOAgIAAgICAgAANAyAEQQhqIQYMAQsgBEH/AToACCAEIAY2AgwjgYCAgAAhByAGDQEgB0GY8cCAAGohBgsgACAGKQIANwIADAULAkAgAyAGSQ0AIAIgBmohAiADIAZrIQMMAgsgBiADIAMjgYCAgABB8PHAgABqELSCgIAAAAsgBC0ACEEDRw0AIAUQ2YKAgAALIAMNAAsLIABB/wE6AAALIARBEGokgICAgAALbQECfyOSgICAACIBIAEoAgAiAkEBajYCAEEAIQECQCACQQBIDQBBASEBI4GAgIAAQdj1wIAAai0AAA0AI4GAgIAAIgFB2PXAgABqIAA6AAAgAUHU9cCAAGoiASABKAIAQQFqNgIAQQIhAQsgAQscACAAKAIAIAEgACgCBCgCDBGEgICAAICAgIAACwcAIABBG0YLLwEBf0ErIQECQCAAQX9qIgBBygBLDQAjgYCAgABB15/AgABqIABqLQAAIQELIAELJQEBfyAAI4GAgIAAQcybwIAAaiICKQIINwIIIAAgAikCADcCAAslAQF/IAAjgYCAgABBvJvAgABqIgIpAgg3AgggACACKQIANwIAC8EBBAN/AX4CfwF+QQAhAwJAQQAgACgCCCIEKAIEIgUgBCkDCCIGQv////8PIAZC/////w9UG6drIgcgByAFSxsiByACIAcgAkkbIghFDQAgBCgCACAGIAWtIgkgBiAJVBunaiABIAj8CgAACyAEIAYgCK18NwMIAkAgByACTw0AI4GAgIAAQZjxwIAAaikDACIGQv8Bg0L/AVENAAJAIAAtAABBA0cN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AAsLIABBAEEAENmBgIAADwsjkYCAgABBHDYCAEF/C7gBAQR/I4CAgIAAQSBrIgMkgICAgABBfyEEAkAgABDggYCAACIARQ0AAkAgACgCBCIFKAIIIgZFDQACQCAAKAIAIANBCGogBhGEgICAAICAgIAAQQBODQBBfyEEDAILIANBCGogASACEOGBgIAAIQQMAQsCQCAFKAJIIgZFDQAgACgCACABIAJBAEEAQQAgBhGFgICAAICAgIAAIQQMAQsjkYCAgABBOjYCAAsgA0EgaiSAgICAACAECysBAX8jgICAgABBEGsiASSAgICAACABIABBAEc6AA8gAUEPahDugYCAAAALIAACQCOBgICAAEH88sCAAGooAgBBf0cNABDcgYCAAAsL/QIBDH8jgICAgABBEGsiACSAgICAACOBgICAACEBIABBCGoQ7YGAgAACQAJAAkAgACgCDCICDQAgAUGg9sCAAGohAwwBCyACQQFqIgFFDQEgAUEEEJaCgIAAIgNFDQEgACgCCCEBIAMhBEEAIQUDQCABQQhqKAIAIQYgASgCACEHIAQgAUEMaigCACIIIAFBBGooAgAiCWoiCkECahCRgoCAACILNgIAAkAgCw0AAkAgBUUNACADIQEDQCABKAIAEJSCgIAAIAFBBGohASAFQX9qIgUNAAsLIAMQlIKAgAAMAwsCQCAJRQ0AIAsgByAJ/AoAAAsgCyAJaiIJQT06AAACQCAIRQ0AIAlBAWogBiAI/AoAAAsgCyAKakEBakEAOgAAIAFBEGohASAEQQRqIQQgAiAFQQFqIgVHDQALIABBCGoQ4oGAgAALI4GAgIAAQfzywIAAaiADNgIAIABBEGokgICAgAAPCyAAQQhqEOKBgIAAQcYAENqBgIAAAAsDAAALagEBfyOBgICAAEGA88CAAGooAgAhAgJAAkAgAA0AIAIQiYKAgAAiAA0BI5GAgIAAQTA2AgBBAA8LAkAgASACEI6CgIAAQQFqTw0AI5GAgIAAQcQANgIAQQAPCyAAIAIQiIKAgAAhAAsgAAv9AgMDfwF+AX8CQAJAAkAjgYCAgABBpPbAgABqLQAADQAjgYCAgABBpPbAgABqQQE6AAAQ/YGAgABBf0oNACAAKAIAIQEgACgCBCECDAELI4GAgIAAIQMgACkCACIEQiCIpyECIASnIQECQAJAIANBqPbAgABqIgMoAgQiACADKAIIRw0AI4GAgIAAQaj2wIAAaiIFKAIAIQMCQCAAIAUoAgxHDQAgAyAAQQF0QQggABsiBUEMbBCXgoCAACIDRQ0CI4GAgIAAQaj2wIAAaiIAIAU2AgwgACADNgIAIAAoAgghAAsgAyAAQQxsaiIDIABBAWo2AgQgA0EAOgAAI4GAgIAAQaj2wIAAaiIAIAAoAghBAWo2AgggACgCBCEACyOBgICAAEGo9sCAAGoiAyADKAIAIABBDGxqIgMoAgQ2AgQgA0EBOgAAIAMgBDcCBCAAQX9KDQIMAQsjkYCAgABBMDYCAAsgASACKAIAEYaAgIAAgICAgABBfyEACyAAC6gBAQF/AkACQCOBgICAAEGk9sCAAGotAAANACOBgICAAEGk9sCAAGpBAToAAEEAIQEQ/YGAgABBAEgNAQsjgYCAgAAhAQJAAkAgAEEASA0AIAAgAUGo9sCAAGooAghJDQELI5GAgIAAQQg2AgBBAA8LAkAjgYCAgABBqPbAgABqKAIAIABBDGxqIgAtAAANACORgICAAEEINgIAQQAPCyAAQQRqIQELIAELggUDAX8CfgJ/I4CAgIAAQTBrIgMkgICAgAACQAJAIAAoAhAgA0EgaiADQShqEPGBgIAARQ0AAkACQAJAA0ACQCADKQMgIgRQDQAgAyAEIAKtIgUgBCAFVBsiBDcDICADIAQ+AhwgAyABNgIYAkAgACgCECADQRhqIANBKGoQ8oGAgAANACADLQAoQQFHDQNBwAAhBgwECyAALQAEQQFHDQQgACgCECADQShqEPOBgIAADQQgAy0AKEEBRw0CQcAAIQYMAwsCQCAALQAEDQAjkYCAgABBBjYCAEF/IQYMBgsCQCAAKAIUIgcoAgAiBg0AIAcgACgCEBD0gYCAADYCACAAKAIUKAIAIQYLIAYQ5YGAgAAhBgJAAkACQCAAKQMIIgRQDQAgBBD7gYCAACEHIAMgBjYCECADIANBEGo2AhggBxDlgYCAACEGIANBAjYCHCADIAY2AhQgA0EYaiADQQhqEPCBgIAAIAcQ5IGAgAAgAygCDCIHRQ0BIAMoAgghBgJAA0AgBigCAEEBRg0BIAZBBGohBiAHQX9qIgdFDQMMAAsLI5GAgIAAQQY2AgAgA0EIahDmgYCAAEF/IQYMCAsgBhDvgYCAAAwBCyADQQhqEOaBgIAACyAAKAIQIANBIGogA0EoahDxgYCAAA0ADAQLCyADKAIsEOOBgIAAQR0hBgsjkYCAgAAgBjYCAEF/IQYMAgsgAykDICIEpyIGQQFIDQEgACgCACIHRQ0BIAcgBykDACAEQv////8Hg3w3AwAMAQtBwAAhBgJAIAMtAChBAUYNACADKAIsEOOBgIAAQR0hBgsjkYCAgAAgBjYCAEF/IQYLIANBMGokgICAgAAgBgt7AQJ/AkAgACgCBCIBRQ0AIAAoAgAiAiEAA0ACQCAAQQRqKAIARQ0AIAAoAgAQlIKAgAALIABCADcCAAJAIABBDGooAgBFDQAgAEEIaigCABCUgoCAAAsgAEEIakIANwIAIABBEGohACABQX9qIgENAAsgAhCUgoCAAAsLCgAgABCAgICAAAsKACAAEIGAgIAACwQAIAALGAACQCAAKAIERQ0AIAAoAgAQlIKAgAALCwoAIAAQgoCAgAALBAAgAAsKACAAEIOAgIAACwQAIAALCgAgABCEgICAAAsKACAAEIWAgIAACzUBAX8jgICAgABBEGsiASSAgICAACABQQhqEIaAgIAAIAAgASkCCDcCACABQRBqJICAgIAACw4AIAAtAAAQh4CAgAAACwoAIAAQiICAgAALPwEBfyOAgICAAEEQayICJICAgIAAIAAoAgAgACgCBCACQQhqEImAgIAAIAEgAikCCDcCACACQRBqJICAgIAAC3cCAX8BfiOAgICAAEEQayIDJICAgIAAIAAgAxCKgICAAAJAAkACQAJAIAMtAAAOAgACAQsgAykDCCEECyABIAQ3AwBBASEADAELIAIgAzUCDEIghkIAIAMxAAgiBFAbIASENwIAQQAhAAsgA0EQaiSAgICAACAAC1wBAX8jgICAgABBEGsiAySAgICAACAAIAEoAgAgASgCBCADQQRqEIuAgIAAAkAgAy0ABEEBRyIBDQAgAiADLQAIOgAAIAIgAygCDDYCBAsgA0EQaiSAgICAACABC1IBAX8jgICAgABBEGsiAiSAgICAACAAIAJBBGoQjICAgAACQCACLQAEQQFHIgANACABIAItAAg6AAAgASACKAIMNgIECyACQRBqJICAgIAAIAALCgAgABCNgICAAAsIABCOgICAAAsIABCPgICAAAsIABCQgICAAAtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCRgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCSgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCTgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgsKACAAEJSAgIAACwgAEJuCgIAAC7ICAQN/I4CAgIAAQSBrIgAkgICAgAACQAJAAkBBAUEUEJaCgIAAIgENACORgICAAEEwNgIADAELIAAgATYCGCAAI4GAgIAAQYTzwIAAajYCHCAAIAApAhg3AxBBfyEBIABBEGoQ34GAgABBAEgNAQJAQQFBFBCWgoCAACICDQAjkYCAgABBMDYCAAwCCyACQQE2AgAgACACNgIYIAAjgYCAgABBhPPAgABqNgIcIAAgACkCGDcDCCAAQQhqEN+BgIAAQQBIDQECQEEBQRQQloKAgAAiAQ0AI5GAgIAAQTA2AgAMAQsgAUECNgIAIAAgATYCGCAAI4GAgIAAQYTzwIAAajYCHCAAIAApAhg3AwBBACEBIAAQ34GAgABBf0oNAQtBfyEBCyAAQSBqJICAgIAAIAELYAEBfwJAIAAoAgwiAUUNACABEOSBgIAACwJAIAAoAhAiAUUNACABEOSBgIAACwJAIAAoAgQiAUUNACABEOeBgIAACwJAIAAoAggiAUUNACABEOmBgIAACyAAEJSCgIAAC2gBAX8CQCAAKAIARQ0AI5GAgIAAQTo2AgBBfw8LAkAgACgCBCICDQAgABD1gYCAACICNgIECyACEOiBgIAAIQIgASAAQQxqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEAC4IBAQF/AkAgACgCCCICDQACQAJAAkACQCAAKAIAQX9qDgICAAELEPeBgIAAIQIMAgsjkYCAgABBOjYCAEF/DwsQ9oGAgAAhAgsgACACNgIICyACEOqBgIAAIQIgASAAQRBqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEACw4AIAFBAEGQAfwLAEEACxMAQYCAgIABQYCAgCAgACgCABsLqAEBAX8jgICAgABBEGsiASSAgICAAAJAAkACQAJAAkAgACgCAA4DAAECAwsgAUEMahD4gYCAAEUNAiABKAIMEOuBgIAAQQEhAAwDCyABQQhqEPmBgIAARQ0BIAEoAggQ7IGAgABBASEADAILIAFBBGoQ+oGAgABFDQAgASgCBBDsgYCAAEEBIQAMAQsjkYCAgABBOzYCAEEAIQALIAFBEGokgICAgAAgAAubAQEEfxDbgYCAAEEAIQECQCAAQT0QhoKAgAAiAiAARg0AIAAgAiAAayIDai0AACECI5OAgIAAIQQgAg0AIAQoAgAiBEUNACAEKAIAIgJFDQAgBEEEaiEEAkADQAJAIAAgAiADEI+CgIAADQAgAiADaiICLQAAQT1GDQILIAQoAgAhAiAEQQRqIQQgAg0ADAILCyACQQFqIQELIAELSQEDf0EAIQMCQCACRQ0AAkADQCAALQAAIgQgAS0AACIFRw0BIAFBAWohASAAQQFqIQAgAkF/aiICDQAMAgsLIAQgBWshAwsgAwvsAgEDfwJAAkACQAJAIAFB/wFxIgJFDQAgAEEDcUUNAgJAIAAtAAAiAw0AIAAPCyADIAFB/wFxRw0BIAAPCyAAIAAQjoKAgABqDwsCQCAAQQFqIgNBA3ENACADIQAMAQsgAy0AACIERQ0BIAQgAUH/AXFGDQECQCAAQQJqIgNBA3ENACADIQAMAQsgAy0AACIERQ0BIAQgAUH/AXFGDQECQCAAQQNqIgNBA3ENACADIQAMAQsgAy0AACIERQ0BIAQgAUH/AXFGDQEgAEEEaiEACwJAQYCChAggACgCACIDayADckGAgYKEeHFBgIGChHhHDQAgAkGBgoQIbCECA0BBgIKECCADIAJzIgNrIANyQYCBgoR4cUGAgYKEeEcNAUGAgoQIIABBBGoiACgCACIDayADckGAgYKEeHFBgIGChHhGDQALCyAAQX9qIQMDQCADQQFqIgMtAAAiAEUNASAAIAFB/wFxRw0ACwsgAwv6AgECfwJAAkACQCABIABzQQNxRQ0AIAEtAAAhAgwBCwJAIAFBA3FFDQAgACABLQAAIgI6AAACQCACDQAgAA8LIABBAWohAwJAIAFBAWoiAkEDcQ0AIAMhACACIQEMAQsgAyACLQAAIgI6AAAgAkUNAiAAQQJqIQMCQCABQQJqIgJBA3ENACADIQAgAiEBDAELIAMgAi0AACICOgAAIAJFDQIgAEEDaiEDAkAgAUEDaiICQQNxDQAgAyEAIAIhAQwBCyADIAItAAAiAjoAACACRQ0CIABBBGohACABQQRqIQELQYCChAggASgCACICayACckGAgYKEeHFBgIGChHhHDQADQCAAIAI2AgAgAEEEaiEAQYCChAggAUEEaiIBKAIAIgJrIAJyQYCBgoR4cUGAgYKEeEYNAAsLIAAgAjoAAAJAIAJB/wFxDQAgAA8LIAFBAWohAiAAIQMDQCADQQFqIgMgAi0AACIAOgAAIAJBAWohAiAADQALCyADCw8AIAAgARCHgoCAABogAAswAQJ/AkAgABCOgoCAAEEBaiIBEJGCgIAAIgJFDQAgAUUNACACIAAgAfwKAAALIAILBAAgAAsMACAAIAEQioKAgAALZQECfwJAI4GAgIAAQbj2wIAAaigCGCIBDQAjgYCAgABBuPbAgABqIgEgATYCGAsjgYCAgAAiAkGioMCAAGogAkHArMCAAGpBACAAIABBzABLG0EBdGovAQBqIAEoAhQQi4KAgAALbQEBfwJAAkAgABCMgoCAACIDEI6CgIAAIgAgAkkNAEHEACEAIAJFDQECQCACQX9qIgJFDQAgASADIAL8CgAACyABIAJqQQA6AABBxAAPCwJAIABBAWoiAkUNACABIAMgAvwKAAALQQAhAAsgAAvPAQEDfyAAIQECQAJAIABBA3FFDQACQCAALQAADQAgACAAaw8LIABBAWoiAUEDcUUNACABLQAARQ0BIABBAmoiAUEDcUUNACABLQAARQ0BIABBA2oiAUEDcUUNACABLQAARQ0BIABBBGoiAUEDcQ0BCyABQXxqIQIgAUF7aiEBA0AgAUEEaiEBQYCChAggAkEEaiICKAIAIgNrIANyQYCBgoR4cUGAgYKEeEYNAAsDQCABQQFqIQEgAi0AACEDIAJBAWohAiADDQALCyABIABrC4cBAQJ/AkAgAg0AQQAPCwJAAkAgAC0AACIDDQBBACEDDAELIABBAWohACACQX9qIQICQANAIANB/wFxIAEtAAAiBEcNASAERQ0BIAJBAEYNASACQX9qIQIgAUEBaiEBIAAtAAAhAyAAQQFqIQAgAw0AC0EAIQMLIANB/wFxIQMLIAMgAS0AAGsLTgACQCAADQA/AEEQdA8LAkAgAEH//wNx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cWoiAigCECIFDQALIAJBEGogADYCACAAIAQ2AhggACAANgIMIAAgADYCCA8LIAQoAggiASAANgIMIAQgADYCCCAAQQA2AhggACAENgIMIAAgATYCCAsLeAECfwJAAkACQCABQRBHDQAgAhCSgoCAACEBDAELQRwhAyABQQNxDQEgAUECdiIERQ0BIARpQQFLDQECQCACQUAgAWtNDQBBMA8LIAFBECABQRBLGyACEJqCgIAAIQELAkAgAQ0AQTAPCyAAIAE2AgBBACEDCyADC60DAQV/AkACQCAAQRAgAEEQSxsiAiACQX9qcQ0AIAIhAAwBC0EgIQMDQCADIgBBAXQhAyAAIAJJDQALCwJAIAFBQCAAa0kNACORgICAAEEwNgIAQQAPCwJAIABBECABQRNqQXBxIAFBC0kbIgFqQQxqEJKCgIAAIgMNAEEADwsgA0F4aiECAkACQCAAQX9qIANxDQAgAiEADAELIANBfGoiBCgCACIFQXhxIAMgAGpBf2pBACAAa3FBeGoiA0EAIAAgAyACa0EPSxtqIgAgAmsiA2shBgJAIAVBA3ENACAAIAY2AgQgACACKAIAIANqNgIADAELIAAgBiAAKAIEQQFxckECcjYCBCAAIAZqIgYgBigCBEEBcjYCBCAEIAMgBCgCAEEBcXJBAnI2AgAgAiADaiIGIAYoAgRBAXI2AgQgAiADEJiCgIAACwJAIAAoAgQiA0EDcUUNACADQXhxIgIgAUEQak0NACAAIAEgA0EBcXJBAnI2AgQgACABaiIDIAIgAWsiAUEDcjYCBCAAIAJqIgIgAigCBEEBcjYCBCADIAEQmIKAgAALIABBCGoLAgALIAEBfwJAIAAoAgAiAUUNACAAKAIEIAFBARDugICAAAsLnwEBAX8jgICAgABBEGsiAySAgICAAAJAIAIgAWoiASACTw0AQQBBABCegoCAAAALIANBBGogACgCACICIAAoAgQgASACQQF0IgIgASACSxsiAkEIIAJBCEsbIgIQn4KAgAACQCADKAIEQQFHDQAgAygCCCADKAIMEJ6CgIAAAAsgAygCCCEBIAAgAjYCACAAIAE2AgQgA0EQaiSAgICAAAscAAJAIABFDQAgACABEKOCgIAAAAsQpYKAgAAAC5ABAAJAAkAgA0EATg0AQQEhAUEEIQJBACEDDAELAkACQAJA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bmcgb2YgbGVuZ3RoIMAAEnJhbmdlIHN0YXJ0IGluZGV4IMAiIG91dCBvZiByYW5nZSBmb3Igc2xpY2Ugb2YgbGVuZ3RoIMAAEHJhbmdlIGVuZCBpbmRleCDAIiBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDAABBhc3NlcnRpb24gYGxlZnQgwBcgcmlnaHRgIGZhaWxlZAogIGxlZnQ6IMAJCiByaWdodDogwAAQYXNzZXJ0aW9uIGBsZWZ0IMAQIHJpZ2h0YCBmYWlsZWQ6IMAJCiAgbGVmdDogwAkKIHJpZ2h0OiDAAMACOiDAAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvaW8vZXJyb3IvdW5peC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pbmRleC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc2hhcmVkL3NtYWxsc29ydC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3N0YWJsZS9xdWlja3NvcnQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlycy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvbXV0ZXgvbm9fdGhyZWFkcy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvcndsb2NrL25vX3RocmVhZHMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvc3RyLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlyLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL3Bvc2l0aW9uLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby93cml0ZS5ycwAvbW50L3dvcmsvcnVubmVyLXNoYXJlZC9jYXJnby1ob21lL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9wZXN0LTIuOS42L3NyYy9wYXJzZXJfc3RhdGUucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3N0ci9tb2QucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy9tb2QucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9pZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlL3JlcHJfaW92ZWMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy91bmljb2RlL3VuaWNvZGVfZGF0YS5ycwANPHNwYW4gY2xhc3M9IsACIj4ALwARc3RhcnQgYnl0ZSBpbmRleCDAJiBpcyBub3QgYSBjaGFyIGJvdW5kYXJ5OyBpdCBpcyBpbnNpZGUgwAggKGJ5dGVzIMALIG9mIHN0cmluZykAD2VuZCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwEcgYnl0ZXMgZmFpbGVkCnNraXBwaW5nIGJhY2t0cmFjZSBwcmludGluZyB0byBhdm9pZCBwb3RlbnRpYWwgcmVjdXJzaW9uCgA1ZmF0YWwgcnVudGltZSBlcnJvcjogZmFpbGVkIHRvIGluaXRpYXRlIHBhbmljLCBlcnJvciDACywgYWJvcnRpbmcKABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDADiBieXRlcyBmYWlsZWQKAAxwYW5pY2tlZCBhdCDAAjoKwDMKdGhyZWFkIHBhbmlja2VkIHdoaWxlIHByb2Nlc3NpbmcgcGFuaWMuIGFib3J0aW5nLgoACQp0aHJlYWQgJ8ADJyAowA4pIHBhbmlja2VkIGF0IMACOgrAAQoAGWFib3J0aW5nIGR1ZSB0byBwYW5pYyBhdCDAAjoKwAEKAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGVjYWxsIGxpbWl0IHJlYWNoZWRzdGFjayBsaW1pdCByZWFjaGVkCmZhbHNlZGVmY2xhc3NyZXR1cm5taWQgPiBsZW5wb3NpdGlvbiBvdXQgb2YgYm91bmRzJmFtcDsmcXVvdDtrd3N0cmluZ2NvbW1lbnRudW1iZXJwdW5jdHVhdGlvbmhsanMtc3RyaW5naGxqcy1hdHRyaGxqcy10YWdobGpzLXN1YnN0aGxqcy1yZWdleHBobGpzLXB1bmN0dWF0aW9uaGxqcy1zeW1ib2xobGpzLXBhcmFtc2hsanMtdHlwZWhsanMtYnVpbHRfaW5obGpzLW1ldGFobGpzLXRpdGxlaGxqcy1udW1iZXJobGpzLWNvbW1lbnRobGpzLWtleXdvcmQ8L3NwYW4+cHl0aG9ud2hpdGVzcGFjZWt3X2NvbnN0dG9rZW5vdGhlcnRva2Vuc2lkZW50aWZpZXIAAAoGBggLBQUGCgcGBgIKBQUG4pCN4pCKYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3RmaWxlIG5hbWUgY29udGFpbmVkIGFuIHVuZXhwZWN0ZWQgTlVMIGJ5dGVtYWluPHVubmFtZWQ+bm90ZTogcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPTFgIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGRpc3BsYXkgYSBiYWNrdHJhY2UKAABc9ulf3AL2ufHBcGzyYcEkDydm8aIVBIpMp/P9dgLfcWZhdGFsIHJ1bnRpbWUgZXJyb3I6IHJ3bG9jayBsb2NrZWQgZm9yIHdyaXRpbmcsIGFib3J0aW5nCnJ3bG9jayBvdmVyZmxvd2VkIHJlYWQgbG9ja3NSVVNUX0JBQ0tUUkFDRWNhbm5vdCByZWN1cnNpdmVseSBhY3F1aXJlIG11dGV4YWR2YW5jaW5nIElvU2xpY2UgYmV5b25kIGl0cyBsZW5ndGhhZHZhbmNpbmcgaW8gc2xpY2VzIGJleW9uZCB0aGVpciBsZW5ndGgAQm94PGR5biBBbnk+dGhyZWFkIGNhdXNlZCBub24tdW53aW5kaW5nIHBhbmljLiBhYm9ydGluZy4Kc3RhY2sgYmFja3RyYWNlOgpub3RlOiBTb21lIGRldGFpbHMgYXJlIG9taXR0ZWQsIHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT1mdWxsYCBmb3IgYSB2ZXJib3NlIGJhY2t0cmFjZS4KZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcnN0cmVycm9yX3IgZmFpbHVyZWZhaWxlZCB0byBnZW5lcmF0ZSB1bmlxdWUgdGhyZWFkIElEOiBiaXRzcGFjZSBleGhhdXN0ZWRyd2xvY2sgaGFzIG5vdCBiZWVuIGxvY2tlZCBmb3IgcmVhZGluZyIBCAkrDSsrKxwrKwYCAx4rKxoMKxsEKysnIxQpKw8SKCArKyEKKwUoKysAKysrJisrGCQHDhArKyQrKysrAQsrKysrERkrExYdH1N1Y2Nlc3MASWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgdW5yZWFjaGFibGUAQWRkcmVzcyBpbiB1c2UAQnJva2VuIHBpcGUASS9PIGVycm9yAE5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3MATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UATm90IGEgc29ja2V0AERlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQATWVzc2FnZSB0b28gbGFyZ2UAUHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0AFByb3RvY29sIG5vdCBhdmFpbGFibGUAUHJvdG9jb2wgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAE9wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzAE9wZXJhdGlvbiBpbiBwcm9ncmVzcwBTdGFsZSBmaWxlIGhhbmRsZQBRdW90YSBleGNlZWRlZABNdWx0aWhvcCBhdHRlbXB0ZWQAQ2FwYWJpbGl0aWVzIGluc3VmZmljaWVudAAAAAAAAAAAAAAAAAAAAAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gXvv71jYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90RXJyb3ICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIGBAcBAQEUAQABJgIyAgMBNwgbBAYLAAE8AmUOOwIxAg8BHAIBAQsFIgXtAQgCAgIWAQcBAQMEAgkCAgIECAEEAgEFAhkCAwEGBAICFgEHAQIBAgECAgEBBQQCAgMDAQcEAQEHEQoDAQkBAwEWAQcBAgEFAgoBAwEDAgEPBAIMBwcBAwEIAgICFgEHAQIBBQIJAgICAwcDBAIBBQISCgIBBgMDAQQDAgEBAQIDAgMDAwwEBQMDAQQCAQYBDhUFDQEDARcBEAIJAQMBBAcCAQMBAgIEAgoHFgEDARcBCgEFAgkBAwEEBwIFAwEEAgoBAwwNAQMBMwEDAQYEEAIaAQMBEgMYAQkBAQIHAwEEBgEBAQgGCgIDDDoEHSUCAQEBBQEYAQEBFwIFAQEBBwEKAgQgSAEkBCcBJAEPAQ0lxgEBBQECAAEEAgcBAQEEAikBBAIhAQQCBwEBAQQCDwE5AQQCQwIgAxoGVgIGAgADWQcWCRgJFAwNAQMBAgxeAgoGCgYaBlkHKwVGCh8BDAQMBAEDKgIFCywEGgYLAz4CQQEdAgsGCgYOAi4CDBRNAaYIPAMPAz4FKwILCCsFAAIGAiYCBgIIAQEBAQEBAR8CNQEPAQ4CBgETAgMBCQFlAQwCGwENAyIOIQ+MBAAWCxUAAgAFLQEBBQECOAcCDhgJBwEHAQcBBwEHAQcBBwEHAX4iGgFZDNYaUAFWAmcFKwFeAVYJMAEAAzcJABS4CN0UPAMKBjgIRggMBnQLHgNOAQsEIQE3CQ4CCgJnGBwKBgIGAgYJBwEHATwEfgIKBgAMFwQxBAACaiYHDAUFGgEFAQEBAgECAQAgKgYzARMBBAQFAYcCAQG+AwYCBgIGAgMDBwEHCgUCDAEaARMBAgEPAg4iewUDBC0DWAENAwEvLoIdAzEPHAQkCR4FKwUeASUEDiqeAgoGJAQkBCgINAsMAQ8BBwECAQsBDwEHAQIDNAwACRYKCBgGASoBCUUGAgEBLAECAwECFwFICAkwEwECBSEDGwUbJjgEFAIyAQIFCAEDAR0CAwQKBwkHQCAnBAwJNgMdAhsFGgcEDAdQSTczDTMHLggKBiYDHQgC0B8BKgEDAgIQBggJIS4IKhYaJhwUFwlOBCQJRAoBAhkHCgY1ARIIJwlgARQLEgEvPgcBAQEEAQ8BCwY7BQoGBAEIAgICFgEHAQIBBQEKAgICAwIBBgEFBwIHAwULCgEBAgEBJgEKAQECAQEEAQoBAggCHVwBBR5ICAqmNgImIkULCgYNEzoGCgYUHBsCDwQXuTxkUwwIAgECCAECAR4BAgIMCQpGCAIuAgsbSAhTDUkHClYIWCIOCgYJAS0BDgodAyACFgEOSQcBAgEsAwEBAgEJCAoGBgECASUBAgEGBwoGLAQK9hkHEQEpAx1VAQ8yDQBmbwEFC8QAYw0ACgAFAAA6AAAHHwEKBFEBCgYeAgYKRgoKAQcBFQUTADrGWwUZAhksSwQ5BxFABQsHCQApIGFzAAQBBwECAQAPAR0DAgEOBAgAAGsFDQMJBwoCCAD9AwAGFw8RDy4CFwl0PPYKJwLCFUZ6FAwUDFcJGYdVAUcBAgIBAgICBAEMAQEBBwFBAQQCCAEHARwBBAEFAQEDBwEAAgAC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AQBAAbgBtgGzAawBqAGhAZIBkAGMAYgBhAKSApACUwNdA5MDhQQMBAYFuwZOAAAAAAAAAAD/AAAA/P//DwKoqqqqqqqq////////BwD//QAAAPz//wAAAAAAAAKAAAAA/////w+Fqv///////wAAAAD/////AAAAAPz///8AAAAAAP///+//AAAA/P//AAABAADw/////w8AAMD///////f/A///wEMAAAAA//8AAAAAAAD//wAAAID//3//wP///wAAAPwAAAAAAAAA+AAA///////3/P//9wMAAPBU1aqqqqqqqqqqqqqqqqqqqqqqqqqqqlX/AP8A/wDfQD8A/wD/AP8//////2IV2j8AAAAAAAAAPyAAAAAAAIo8AMQIAACAEDIAAID/+//7G/9/46qqqi8Zuf///////QcKpaoKAABeBwAAAAAABCAE///P/////wH/AD8A/wD/ANwAzwD/ANwAqqqqqhpQCAD/////vyAAAP/7/3/gBwAAAMDf//8AAAADAAAAHwAAAKqqqjoAAAAAfwD4AAAAAAD3CwAAAAAAAP8FAAAAAAAAqqqqqqqq+pOqqqqqqqr/lUBSVbWqqimqqlC6qqqCoKr/////qqqqqgAAAACoqquqVauqqqqqqtQpMSROKi1R5vz//w8AAMDrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAQDjkAAAAAAAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAC0AAAAAAAAAAAAAAAAIEz4AAAAAAAAAAAAAAAAARSwANTEzIgAAAAAJOgAAAAAAAAAAAAAAAAADABA7AAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAHAAAAEAAAAAAAAAAAAAAAAAAAABJAAAAAAAAAAAAAAAAAAAjERg2NzIwByQrAB0MIAAALwA5OTkAFxdHFyUaGSYABUgAHg9NAAAAAAAAAAAACj0ABgAAHwAAAAAAAAAhABAbFycoAAAAAAAAAAAAAAAQNAIWRgg8AAAAAAAAAAAAEEoAAAAAAAAAAAAAAAAAAEMqOAtEQRINAUJOFUtMBC4AtgBKAKYAogCfAJYAlACOAIYAgwBAAUIBRgFTAQwBCAKSAowChgKCA6QDkgMUBLIEqwAAAAAAAP///////z8A/z8AAAD///8BAAAA/P//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");
		Promise.resolve(module0).catch(() => {});
		let module1 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgA39/fwBgAn9/AGAEf39/fwBgAX8AAwkIAAECAQMDAwMEBQFwAQgIBywJATAAAAExAAEBMgACATMAAwE0AAQBNQAFATYABgE3AAcIJGltcG9ydHMBAApfCA0AIAAgASACQQARAAALCwAgACABQQERAQALDwAgACABIAIgA0ECEQIACwsAIAAgAUEDEQEACwkAIABBBBEDAAsJACAAQQURAwALCQAgAEEGEQMACwkAIABBBxEDAAsALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1NC4w");
		Promise.resolve(module1).catch(() => {});
		let module2 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgA39/fwBgAn9/AGAEf39/fwBgAX8AAjgJAAEwAAAAATEAAQABMgACAAEzAAEAATQAAwABNQADAAE2AAMAATcAAwAIJGltcG9ydHMBcAEICAkOAQBBAAsIAAECAwQFBgcALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1NC4w");
		Promise.resolve(module2).catch(() => {});
		let instanceFlags0 = new WebAssembly.Global({
			value: "i32",
			mutable: !0
		}, 1);
		INSTANCE_FLAGS.set(0, instanceFlags0);
		({exports: exports0} = yield instantiateCore(WebAssembly, yield module1));
		({exports: exports1} = yield instantiateCore(WebAssembly, yield module0, {
			"wasi:cli/environment@0.2.0": { "get-environment": Object.assign(exports0[4], { _jcoMaySuspend: !1 }) },
			"wasi:cli/exit@0.2.0": { exit: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline6, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stderr@0.2.0": { "get-stderr": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline11, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stdin@0.2.0": { "get-stdin": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline9, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stdout@0.2.0": { "get-stdout": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline10, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-input@0.2.0": { "[resource-drop]terminal-input": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline4), !0), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-output@0.2.0": { "[resource-drop]terminal-output": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline5), !0), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stderr@0.2.0": { "get-terminal-stderr": Object.assign(exports0[7], { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stdin@0.2.0": { "get-terminal-stdin": Object.assign(exports0[5], { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stdout@0.2.0": { "get-terminal-stdout": Object.assign(exports0[6], { _jcoMaySuspend: !1 }) },
			"wasi:clocks/monotonic-clock@0.2.0": { "subscribe-duration": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline12, !1), { _jcoMaySuspend: !1 }) },
			"wasi:io/error@0.2.0": { "[resource-drop]error": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline0), !0), { _jcoMaySuspend: !1 }) },
			"wasi:io/poll@0.2.0": {
				"[method]pollable.block": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline7, !1), { _jcoMaySuspend: !1 }),
				"[resource-drop]pollable": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline1), !0), { _jcoMaySuspend: !1 }),
				poll: Object.assign(exports0[0], { _jcoMaySuspend: !1 })
			},
			"wasi:io/streams@0.2.0": {
				"[method]output-stream.blocking-flush": Object.assign(exports0[3], { _jcoMaySuspend: !1 }),
				"[method]output-stream.check-write": Object.assign(exports0[1], { _jcoMaySuspend: !1 }),
				"[method]output-stream.subscribe": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline8, !1), { _jcoMaySuspend: !1 }),
				"[method]output-stream.write": Object.assign(exports0[2], { _jcoMaySuspend: !1 }),
				"[resource-drop]input-stream": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline2), !0), { _jcoMaySuspend: !1 }),
				"[resource-drop]output-stream": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline3), !0), { _jcoMaySuspend: !1 })
			}
		}));
		memory0 = exports1.memory;
		realloc0 = (oldPtr, oldSize, align, newSize) => exports1.cabi_realloc(oldPtr, oldSize, align, newSize) >>> 0;
		try {
			WebAssembly.promising(exports1.cabi_realloc);
		} catch {}
		({exports: exports2} = yield instantiateCore(WebAssembly, yield module2, { "": {
			$imports: exports0.$imports,
			0: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline13, !1), { _jcoMaySuspend: !1 }),
			1: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline14, !1), { _jcoMaySuspend: !1 }),
			2: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline15, !1), { _jcoMaySuspend: !1 }),
			3: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline16, !1), { _jcoMaySuspend: !1 }),
			4: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline17, !1), { _jcoMaySuspend: !1 }),
			5: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline18, !1), { _jcoMaySuspend: !1 }),
			6: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline19, !1), { _jcoMaySuspend: !1 }),
			7: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline20, !1), { _jcoMaySuspend: !1 })
		} }));
		postReturn0 = exports1.cabi_post_highlight;
		try {
			WebAssembly.promising(exports1.cabi_post_highlight);
		} catch {
			exports1.cabi_post_highlight;
		}
		postReturn1 = exports1.cabi_post_languages;
		try {
			WebAssembly.promising(exports1.cabi_post_languages);
		} catch {
			exports1.cabi_post_languages;
		}
		exports1Highlight = exports1.highlight;
		exports1Languages = exports1.languages;
	})();
	let promise, resolve, reject;
	function normalizeInstantiationError(e) {
		if (typeof WebAssembly < "u" && typeof WebAssembly.SuspendError == "function" && e instanceof WebAssembly.SuspendError) return new WebAssembly.RuntimeError("cannot block a synchronous task before returning");
		return e;
	}
	function runNext(value) {
		try {
			let done;
			do
				({value, done} = gen.next(value));
			while (!(value instanceof Promise) && !done);
			if (done) {
				if (resolve) resolve(value);
				else return value;
			}
			promise ||= new Promise((_resolve, _reject) => (resolve = _resolve, reject = _reject));
			value.then(runNext, (e) => reject(normalizeInstantiationError(e)));
		} catch (e) {
			e = normalizeInstantiationError(e);
			if (reject) reject(e);
			else throw e;
		}
	}
	let maybeSyncReturn = runNext(null);
	return promise || maybeSyncReturn;
})();
export { highlight, languages };
export const _util = {
	stop: _stopInstance.bind(void 0, _jcoComponentStopContext),
	whenIdle: _whenIdle.bind(void 0, _jcoComponentIdleContext)
};
