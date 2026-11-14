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
import { insecureSeed as insecureSeed$1 } from "@bytecodealliance/preview2-shim/random";
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
const { insecureSeed } = insecureSeed$1;
if (insecureSeed === void 0) {
	let err = Error("unexpectedly undefined local import 'insecureSeed', was 'insecureSeed' available at instantiation?");
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
const _trampoline13 = function(arg0) {
	_debugLog("[iface=\"wasi:random/insecure-seed@0.2.12\", function=\"insecure-seed\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "insecureSeed",
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
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => insecureSeed())
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
	var [tuple0_0, tuple0_1] = ret;
	dataView(_jcoDataViewCacheContext, memory0).setBigInt64((arg0 >>> 0) + 0, toUint64(_jcoStrictNumericContext, tuple0_0), !0);
	dataView(_jcoDataViewCacheContext, memory0).setBigInt64((arg0 >>> 0) + 8, toUint64(_jcoStrictNumericContext, tuple0_1), !0);
	_debugLog("[iface=\"wasi:random/insecure-seed@0.2.12\", function=\"insecure-seed\"][Instruction::Return]", {
		funcName: "insecure-seed",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline13.fnName = "wasi:random/insecure-seed@0.2.12#insecureSeed";
const _trampoline14 = function(arg0, arg1, arg2) {
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
_trampoline14.fnName = "wasi:io/poll@0.2.12#poll";
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
const _trampoline15 = function(arg0, arg1) {
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
_trampoline15.fnName = "wasi:io/streams@0.2.12#checkWrite";
const _trampoline16 = function(arg0, arg1, arg2, arg3) {
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
_trampoline16.fnName = "wasi:io/streams@0.2.12#write";
const _trampoline17 = function(arg0, arg1) {
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
_trampoline17.fnName = "wasi:io/streams@0.2.12#blockingFlush";
const _trampoline18 = function(arg0) {
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
_trampoline18.fnName = "wasi:cli/environment@0.2.12#getEnvironment";
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
const _trampoline19 = function(arg0) {
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
_trampoline19.fnName = "wasi:cli/terminal-stdin@0.2.12#getTerminalStdin";
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
const _trampoline20 = function(arg0) {
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
_trampoline20.fnName = "wasi:cli/terminal-stdout@0.2.12#getTerminalStdout";
const _trampoline21 = function(arg0) {
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
_trampoline21.fnName = "wasi:cli/terminal-stderr@0.2.12#getTerminalStderr";
let exports2;
let postReturn0;
let exports1Parse;
function parse(arg0) {
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfTrapped();
	let { task, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
		componentIdx: 0,
		isAsync: !1,
		isManualAsync: !1,
		preserveFutureResult: !1,
		entryFnName: "exports1Parse",
		getCallbackFn: () => null,
		callbackFnName: null,
		errHandling: "none",
		callingWasmExport: !0
	});
	task.setCalleeIsAsync(!1);
	task.setFuncTypeIsAsync(!1);
	task.setReturnResultTypeIdx(20);
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
				_debugLog("[iface=\"parse\", function=\"parse\"][Instruction::CallWasm] enter", {
					funcName: "parse",
					paramCount: 2,
					async: !1,
					postReturn: !0
				});
				let ret;
				try {
					ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
						taskID: task.id(),
						threadID,
						componentIdx: task.componentIdx(),
						fn: () => exports1Parse(ptr0, len0)
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
				let variant2;
				switch (dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 0, !0)) {
					case 0:
						variant2 = void 0;
						break;
					case 1:
						var ptr1 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 4, !0) >>> 0;
						var len1 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 8, !0) >>> 0;
						if (ptr1 > memory0.buffer.byteLength || len1 > Math.floor((memory0.buffer.byteLength - ptr1) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
						variant2 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr1, len1));
						break;
					default: throw TypeError("invalid variant discriminant for option");
				}
				_debugLog("[iface=\"parse\", function=\"parse\"][Instruction::Return]", {
					funcName: "parse",
					paramCount: 1,
					async: !1,
					postReturn: !0
				});
				task.resolve([{ json: variant2 }]);
				let retCopy = { json: variant2 };
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
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatTuple({
		elemLowerMetas: [[
			_lowerFlatU64.bind(void 0, _jcoStrictNumericContext),
			8,
			8
		], [
			_lowerFlatU64.bind(void 0, _jcoStrictNumericContext),
			8,
			8
		]],
		size32: 16,
		align32: 8
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
	importFn: _trampoline13
});
let trampoline14 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 14,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline14.manuallyAsync,
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
	importFn: _trampoline14
});
let trampoline15 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 15,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline15.manuallyAsync,
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
	importFn: _trampoline15
});
let trampoline16 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 16,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline16.manuallyAsync,
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
	importFn: _trampoline16
});
let trampoline17 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 17,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline17.manuallyAsync,
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
	importFn: _trampoline17
});
let trampoline18 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 18,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline18.manuallyAsync,
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
let trampoline21 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 21,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline21.manuallyAsync,
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
	importFn: _trampoline21
});
await (() => {
	let gen = (function* _initGenerator() {
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABhQETYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gB39/f39/f38AYAZ/f39/f38AYAR/f39/AX9gBH5+f38BfmAIf39/f39/f38AYAV/f39/fwF/Ap0IFiB3YXNpOnJhbmRvbS9pbnNlY3VyZS1zZWVkQDAuMi4xMg1pbnNlY3VyZS1zZWVkAAYTd2FzaTppby9lcnJvckAwLjIuMBRbcmVzb3VyY2UtZHJvcF1lcnJvcgAGEndhc2k6aW8vcG9sbEAwLjIuMBdbcmVzb3VyY2UtZHJvcF1wb2xsYWJsZQAGFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbcmVzb3VyY2UtZHJvcF1pbnB1dC1zdHJlYW0ABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAcW3Jlc291cmNlLWRyb3Bdb3V0cHV0LXN0cmVhbQAGHXdhc2k6Y2xpL3Rlcm1pbmFsLWlucHV0QDAuMi4wHVtyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLWlucHV0AAYed2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4wHltyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLW91dHB1dAAGGndhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wD2dldC1lbnZpcm9ubWVudAAGE3dhc2k6Y2xpL2V4aXRAMC4yLjAEZXhpdAAGEndhc2k6aW8vcG9sbEAwLjIuMBZbbWV0aG9kXXBvbGxhYmxlLmJsb2NrAAYSd2FzaTppby9wb2xsQDAuMi4wBHBvbGwABxV3YXNpOmlvL3N0cmVhbXNAMC4yLjAhW21ldGhvZF1vdXRwdXQtc3RyZWFtLmNoZWNrLXdyaXRlAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQACFXdhc2k6aW8vc3RyZWFtc0AwLjIuMCRbbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gAARV3YXNpOmlvL3N0cmVhbXNAMC4yLjAfW21ldGhvZF1vdXRwdXQtc3RyZWFtLnN1YnNjcmliZQAAFHdhc2k6Y2xpL3N0ZGlu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IAAgASAFajYCAAvVCgMCfwJ+CH8jgICAgABBwABrIgMkgICAgAACQAJAAkACQAJAAkACQAJAIAJBf2oiBA4CAQIACyADIAEgBGo2AhggAyOCgICAAEGAgICAAGqtQiCGIgUgA0EYaq0iBoQ3AyggA0EMaiOBgICAAEHhhMCAAGogA0EoahCogoCAACAEIAIgBCACSRsiB0EMbCEIQQAhAiAHQarVqtUASw0DAkACQCAIDQBBBCEJQQAhCgwBCxD1gICAAEEEIQIgByEKIAhBBBDygICAACIJRQ0ECyAFIANBPGqthCEFIAchBCAJIQIDQCADIAE2AjwgAyAFNwMYIANBKGojgYCAgABB4YTAgABqIANBGGoQqIKAgAAgAiADKAIwNgIIIAIgAykCKDcCACACQQxqIQIgAUEBaiEBIARBf2oiBA0ACwJAAkAgCUEIaigCACILIAhBdGoiDEEMbkEBdGoiAiALSQ0AIAlBBGooAgAhDSAIQQxGDQEgCUEUaiEBIAwhBANAIAEoAgAiCCACaiICIAhJDQEgAUEMaiEBIARBdGoiBEUNAgwACwsjgYCAgAAiA0HomsCAAGpBNSADQZjfwIAAahDLgoCAAAALQQAhASACQQBIDQQCQAJAIAINAEEBIQ4MAQsQ9YCAgABBASEBIAJBARDygICAACIORQ0FC0EAIQEgA0EANgIwIAMgDjYCLCADIAI2AigCQAJAAkAgCyACTQ0AIANBKGpBACALQQFBARCagICAACADKAIsIQ4gAygCMCEBDAELIAtFDQELIAtFDQAgDiABaiANIAv8CgAACyACIAEgC2oiAWshCAJAIAdBAUYNACAJQRRqIQQgDiABaiELA0AgCEEBTQ0HIARBfGooAgAhDiAEKAIAIQEgC0GswAA7AAAgCEF+aiIIIAFJDQggC0ECaiELAkAgAUUNACALIA4gAfwKAAALIARBDGohBCAIIAFrIQggCyABaiELIAxBdGoiDA0ACwsgAyADKQIoNwIYIAMgAiAIazYCICAJIQEDQAJAIAEoAgAiAkUNACABQQRqKAIAIAJBARDzgICAAAsgAUEMaiEBIAdBf2oiBw0ACwJAIApFDQAgCSAKQQxsQQQQ84CAgAALIAMjgoCAgABBgYCAgABqrUIghiIFIANBDGqthDcDMCADIAUgBoQ3AyggACOBgICA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ACABNgIEIAAgAzYCACACQRBqJICAgIAAC5ELAQl/I4CAgIAAQdAAayICJICAgIAAQQEhAwJAAkACQAJAAkAgAUEBEICBgIAARQ0AIAEoAhghBCACIAEoAowBNgIYIAIgASkChAE3AxAgASgCPCEDAkAgASgCVCIFIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgBUEBajYCVCABKAJQIAVBA3RqIgUgAzYCBCAFIAM2AgACQAJAIAFBARCAgYCAAEUNACABKAIYIQYgAiABQYQBaiIDKAIINgIoIAIgAykCADcDICABKAI8IQUCQCABKAJUIgcgASgCTEcNACABQcwAahCmgICAAAsgASAHQQFqNgJUIAEoAlAgB0EDdGoiByAFNgIEIAcgBTYCAAJAIAFBARCAgYCAAEUNACABIAEtAJQBIghBAUc6AJQBIAIgAygCCDYCOCACIAMpAgA3AzAgASgCPCEFAkAgASgCVCIHIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEoAlAgB0EDdGoiCSAFNgIEIAkgBTYCACABIAdBAWo2AlRBACEFAkAgASgCjAEiByABKAKIAU8NACADKAIAIAdqLQAAQd0ARw0AIAEgB0EBajYCjAFBASEFCwJAIAEtAIABQQFHDQAQ9YCAgABBAUEBEPKAgIAAIglFDQUgCUHdADoAACACQQE2AkwgAiAJNgJIIAJCgICAgBA3AkAgASAHIAJBwABqIAUQoICAgAALAkACQAJAIAUNAEEAIQUCQCABKAKMASIHIAEoAogBTw0AIAMoAgAgB2otAABBKUcNACABIAdBAWo2AowBQQEhBQsCQCABLQCAAUEBRw0AEPWAgIAAQQFBARDygICAACIJRQ0JIAlBKToAACACQQE2AkwgAiAJNgJIIAJCgICAgBA3AkAgASAHIAJBwABqIAUQoICAgAALIAUNAEEAIQUCQCABKAKMASIHIAEoAogBTw0AIAMoAgAgB2otAABB/QBHDQAgASAHQQFqNgKMAUEBIQULAkAgAS0AgAFBAUcNABD1gICAAEEBQQEQ8oCAgAAiA0UNCiADQf0AOgAAIAJBATYCTCACIAM2AkggAkKAgICAEDcCQCABIAcgAkHAAGogBRCggICAAAsgBUUNAQtBACEDDAELIAJBCGogARCvgICAACACKAIMIQEgAigCCCEDCyABIAIoAjg2AowBIAEgAikDMDcChAEgASAIOgCUASABQTRqIgcQqICAgAAgAS0ADEECRw0AIANBAXFFDQAgASgCiAEhBSABKAKEASEJAkAgASgCjAEiA0UNAAJAIAMgBUkNACADIAVGDQEMCQsgCSADaiwAAEFASA0ICyADIAVGDQBBASEFAkAgCSADaiIJLAAAIgZBf0oNACAJLQABQT9xIQggBkEfcSEKAkACQCAGQWBPDQAgCkEGdCAIciEGDAELIAhBBnQgCS0AAkE/cXIhCAJAIAZBcE8NACAIIApBDHRyIQYMAQsgCEEGdCAJLQADQT9xciAKQRJ0QYCA8ABxciEGCyAGQYABSQ0AQQIhBSAGQYAQSQ0AQQNBBCAGQYCABEkbIQULIAEgBSADajYCjAEgBxCpgICAAEEAIQMMAgsgASACKAIoNgKMASABIAIpAyA3AoQBAkAgBiABKAIYSw0AIAEgBjYCGAsgAUE0ahCogICAAAtBASEDCwJAIANBAUcNACABIAIoAhg2AowBIAEgAikDEDcChAECQCAEIAEoAhhLDQAgASAENgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAAgATYCBCAAIAM2AgAgAkHQAGokgICAgAAPC0EBQQEQooKAgAAAC0EBQQEQooKAgAAAC0EBQQEQooKAgAAACyAJIAUgAyAFI4GAgIAAQZjgwIAAahDGgoCAAAALoBEBDn8jgICAgABB0ABrIgIkgICAgABBASEDAkAgAUEBEICBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAAkACQAJAAkAgAUEBEICBgIAARQ0AIAEoAhghDCACIAEoAowBNgIoIAIgASkChAE3AyAgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAFBhAFqIQ0gASgCUCALQQN0aiIOIAM2AgQgDiADNgIAIAEgC0EBajYCVEEAIQsCQCABKAKMASIDQXxLDQAgA0EDaiIPIAEoAogBSw0AIA0oAgAgA2oiDi8AAEGt2gBzIA5BAmotAABBLXNyQf//A3ENACABIA82AowBQQEhCwsCQCABLQCAAUEBRw0AEPWAgIAAQQNBARDygICAACIORQ0CIA5BLToAAiAOQa3aADsAACACQQM2AjwgAiAONgI4IAJCgICAgDA3AjAgASADIAJBMGogCxCggICAAAsCQAJAAkAgC0UNACABQQEQgIGAgABFDQAgASgCGCEOIAIgDSgCCDYCSCACIA0pAgA3A0AgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgACQCABQQEQgIGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsgAS0ADEECRg0CCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAO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QQN0aiIGIAU2AgQgBiAFNgIAAkAgAUEBEICBgIAARQ0AIAEoAhghByACIAFBhAFqIgUoAgg2AjggAiAFKQIANwMwIAEoAjwhBgJAIAEoAlQiCCABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASAIQQFqNgJUIAEoAlAgCEEDdGoiCCAGNgIEIAggBjYCAAJAIAFBARCAgYCAAEUNACABKAIYIQggAiAFKAIINgJIIAIgBSkCADcDQCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCAAJAAkAgAUEBEICBgIAARQ0AIAJBGGogARCvgICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEICBgIAARQ0AAkACQCABQQEQgIGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQRBqIAEQr4CAgAAgAigCFCEBAkAgAigCECIFQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAVBAXENAANAAkACQCABQQEQgIGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQQhqIAEQr4CAgAAgAigCDCEBAkAgAigCCCIFQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAFQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJINgKMASABIAIpA0A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAIgARDJgICAACACKAIEIQEgAigCACEDCwJAIANBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCAHIAEoAhhLDQAgASAHNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBRw0AIAEgAigCKDYCjAEgASACKQMgNwKEAQJAIAQgASgCGEsNACABIAQ2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgACADNgIAIAAgATYCBCACQeAAaiSAgICAAAuUFQEOfyOAgICAAEHwAGsiAiSAgICAAEEBIQMCQCABQQEQgIGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASEDAkACQAJAAkACQAJAAkAgAUEBEICBgIAARQ0AIAEoAhghCyACIAEoAowBNgJIIAIgASkChAE3A0AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQgIGAgABFDQAgASgCGCEOIAIgAUGEAWoiDCgCCDYCWCACIAwpAgA3A1AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQAJAIAFBARCAgYCAAEUNACACQThqIAEQsoCAgAAgAigCPCEBAkAgAigCOEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEwaiABELKAgIAAIAIoAjQhAQJAIAIoAjAiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCAMQQFxDQADQAJAAkAgAUEBEICBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEoaiABELKAgIAAIAIoAiwhAQJAIAIoAigiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgDEEBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAACACQSBqIAEQ4YCAgAAgAigCJCEBIAIoAiBBAXENACABQQEQgIGAgABFDQAgASgCGCEOIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAIAFBARCAgYCAAEUNACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEQaiABELKAgIAAIAIoAhQhAQJAIAIoAhAiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCAMQQFxDQADQAJAAkAgAUEBEICBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCIN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AQsgASgCGCEJIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCIFQQFHDQAgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAFQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJoNgKMASABIAIpA2A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBIGogARDLgICAACACKAIkIQEgAigCIEEBcQ0AIAFBARCAgYCAAEUNACABKAIYIQggAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkACQCABQQEQgIGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgBUEBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgVB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ASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEoaiABEOWAgIAAIAIoAiwhAQJAIAIoAihBAXENACABQQEQgIGAgABFDQAgASgCGCEOIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEICBgIAARQ0AIAJBIGogARCygICAACACKAIkIQECQCACKAIgQQFxDQAgAUEBEICBgIAARQ0AAkACQCABQQEQgIGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQgIGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJINgKMASABIAIpA0A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAQQEhCyABQQEQgIGAgABFDQAgAkEIaiABEOiAgIAAIAIoAgwh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ENqAgIAACyAAQX82AgQgAEEAOgAACyACQfAAaiSAgICAAA8LIBQgAyOBgICAAEG438CAAGoQvoKAgAAACyAMIAUjgYCAgABBuN/AgABqEL6CgIAAAAv6ZAQBfwF+N38BfiOAgICAAEGABWsiAySAgICAACADQRhqQQEgASACEN+AgIAAAkACQAJAAkAgAygCGEECRg0AIAMgAygCUDYC8AIgAyADKQJINwPoAiADIAMpAkA3A+ACIAMgAykCODcD2AIgAyADKQIwNwPQAiADIAMpAig3A8gCIAMgAykCIDcDwAIgAyADKQIYNwO4AiADI4KAgIAAQYKAgIAAaq1CIIYgA0G4AmqthDcDqAMgA0HQBGojgYCAgABBxYTAgABqIANBqANqEKiCgIAAAkACQAJAIAMoAtgCIgJBf0YNAAJAIAJFDQAgAygC3AIgAkEBEPOAgIAACyADKALkAiICRQ0CQRAhAQwBCyADKALcAiICRQ0BQQghAQsgA0HYAmogAWooAgAgAkEBEPOAgIAACwJAIAMoAvACIgIoAgwiAUEBSA0AIAIoAhAgAUEBEPOAgIAACwJAIAIoAgAiAUUNACACKAIEIAFBARDzgICAAAsCQCACKAIYIgFBAUgNACACKAIcIAFBARDzgICAAAsCQCACKAIkQX9GDQAgAkEkahC5gICAAAsgAkHQAEEEEPOAgIAAIAMgAykC0AQiBDcDoAQgAyADKALYBCICNgKoBCADIAI2AvgDIAMgBDcD8AMgACACNgIMIAAgBDcCBCAAQX82AgAMAQsgAyADKQIsNwNYIAMgAygCNDYCYCADIAMpAiA3A2ggAyADKAIoNgJwIAMoAhwhAkEAIQUgA0EANgJ8IANCgICAgMAANwJ0IANBADYCiAEgA0KAgICAwAA3AoABAkAjhICAgAAtABBBAUYNAEEAELaAgIAACyOEgICAACIBIAEpAwAiBEIBfDcDACADIAEpAwg3A9ACIAMgBDcDyAIgAyOBgICAAEH43sCAAGoiASkDADcDuAIgAyABKQMINwPAAiADIAMpA1giBDcCnAEgAyACNgKMASADIAMpA2g3ApABIAMgAygCcDYCmAEgAyADKAJgNgKkAQJAIASnIgYgAygCoAFPDQAgA0EYakEMaiEHIANB0ARqQQxqIQggA0HsBGpBDGohCSADQbwEakEM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C0F/IS9BASEsDCELICQgMiOBgICAAEG438CAAGoQvoKAgAAACyOBgICAACIDQdmZwIAAakEoIANByN/AgABqELGCgIAAAAsgMyAyI4GAgIAAQfjhwIAAahC+goCAAAALI4GAgIAAIgNB2ZnAgABqQSggA0GI4sCAAGoQsYKAgAAACyAkIDIjgYCAgABB2OHAgABqEL6CgIAAAAsjgYCAgAAiA0HZmcCAAGpBKCADQejhwIAAahCxgoCAAAALICsgMiOBgICAAEG438CAAGoQvoKAgAAACyOBgICAACIDQdmZwIAAakEoIANByN/AgABqELGCgIAAAAsgNiAyI4GAgIAAQfjhwIAAahC+goCAAAALICsgMiOBgICAAEG438CAAGoQvoKAgAAACyOBgICAACIDQdmZwIAAakEoIANByN/AgABqELGCgIAAAAsgNiAyI4GAgIAAQfjhwIAAahC+goCAAAALI4GAgIAAIgNB2ZnAgABqQSggA0HI38CAAGoQsYKAgAAACyAvICwjgYCAgABB+OHAgABqEL6CgIAAAAsjgYCAgAAiA0HZmcCAAGpBKCADQYjiwIAAahCxgoCAAAALI4GAgIAAIgNB2ZnAgABqQSggA0HI38CAAGoQsYKAgAAACyAvICwjgYCAgABB+OHAgABqEL6CgIAAAAsjgYCAgAAiA0HZmcCAAGpBKCADQYjiwIAAahCxgoCAAAALICsgGEYNACAcICtqLAAAQb9/TA0BCyADQRBqIBwgJGogKyAkaxCXgICAAEEAISsgAygCFCIkQQBIDQIgJA0BQgEhPAwDCyAcIBggJCArI4GAgIAAQcjhwIAAahDGgoCAAAALIAMoAhAhLxD1gICAAEEBISsgJEEBEPKAgIAAIixFDQACQCAkRQ0AICwgLyAk/AoAAAsgLK0hPAwBCyArICQQooKAgAAACyACIAIoAgBBf2oiKzYCAAJAICsNACADQewEahDZgICAAAsgASABKAIAQX9qIis2AgAgKw0AIAkQ2oCAgAALIAIgAigCAEF/aiIrNgIAAkAgKw0AIANBGGoQ2YCAgAALIAEgASgCAEF/aiIrNgIAAkAgKw0AIAcQ2oCAgAALIAIgAigCAEF/aiIrNgIAICStQiCGIQQCQCArDQAgA0HQBGoQ2YCAgAALIAQgPIQhBCABIAEoAgBBf2oiKzYCAAJAICsNACAIENqAgIAAC0EBISwCQCAEQoCAgIAQVA0AICQhLwwKC0F/IS8gJEUNCEEBISwgPKcgJEEBEPOAgIAADAgLIC8gMiOBgICAAEG438CAAGoQvoKAgAAACyArIBhGDQAgHCAraiwAAEG/f0wNAQsgA0EIaiAcICRqICsgJGsQl4CAgABBACErIAMoAgwiJEEASA0CICQNAUIBITwMAwsgHCAYICQgKyOBgICAAEHI4cCAAGoQxoKAgAAACyADKAIIIS8Q9YCAgABBASErICRBARDygICAACIsRQ0AAkAgJEUNACAsIC8gJPwKAAALICytITwMAQsgKyAkEKKCgIAAAAsgAiACKAIAQX9qIis2AgACQCArDQAgA0HsBGoQ2YCAgAALIAEgASgCAEF/aiIrNgIAICsNACAJENqAgIAACyACIAIoAgBBf2oiKzYCAAJAICsNACADQRhqENmAgIAACyABIAEoAgBBf2oiKzYCAAJAICsNACAHENqAgIAACyACIAIoAgBBf2oiKzYCACAkrUIghiEEAkAgKw0AIANB0ARqENmAgIAACyAEIDyEIQQgASABKAIAQX9qIis2AgACQCArDQAgCBDagICAAAtBACEsAkAgBEKAgICAEFQNACAkIS8MAgtBfyEvICRFDQAgPKcgJEEBEPOAgIAACwsgAiACKAIAQX9qIiQ2AgACQCAkDQAgA0GgBGoQ2YCAgAALIAEgASgCAEF/aiIkNgIAICQNAwwCCyAvIDIjgYCAgABBuN/AgABqEL6CgIAAAAsgAiACKAIAQX9qIiQ2AgAgAyAvNgK4BCADIDc2ArAEAkAgJA0AIANBoARqENmAgIAAC0F/IS8gASABKAIAQX9qIiQ2AgBBACEsICQNAQsgCxDagICAAAsCQCADKALsAyIkIAMoAuQDRw0AIANB5ANqENSAgIAACyADKALoAyIwICRBBHRqIisgBDcCCCArIC82AgQgKyAsOgAAIAMgJEEBaiIkNgLsAwwBCyACIAIoAgBBf2oiJTYCACADIC82AjAgAyAzNgIoAkAgJQ0AIANBGGoQ2YCAgAALIAEgASgCAEF/aiIlNgIAAkAgJQ0AIAcQ2oCAgAALIANB9ABqIANBuAJqIDUgN0EAIDogNkF/RhsgOSA0ENCAgIAAAkAgAygC4AMiKyADKALYA0cNACAD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gICAAEEBIQMCQCABQQEQgIGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASELAkAgAUEBEICBgIAARQ0AIAEoAhghDCACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGYAWogARDMgICAACACKAKcASEBAkAgAigCmAFBAXENACABQQEQgIGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQgIGAgABFDQAgAkGQAWogARCygICAACACKAKUASEBAkAgAigCkAFBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGIAWogARCygICAACACKAKMASEBAkAgAigCiAEiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQgIGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBgAFqIAEQsoCAgAAgAigChAEhAQJAIAIoAoABIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB+ABqIAEQy4CAgAAgAigCfCEBIAIoAnhBAXENACABQQEQgIGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQgIGAgABFDQAgAkHwAGogARCygICAACACKAJ0IQECQCACKAJwQQFxDQAgAUEBEICBgIAARQ0AAkACQCABQQEQgIGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB6ABqIAEQsoCAgAAgAigCbCEBAkAgAigCaCIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHgAGogARCygICAACACKAJkIQECQCACKAJgIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB2ABqIAEQzICAgAAgAigCXCEBIAIoAlhBAXENAAJAIAFBARCAgYCAAA0AQQEhCwwBCyABKAIYIQ4gAiABKAKMATYCuAEgAiABKQKEATcDsAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhCyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkAgAUEBEICBgIAARQ0AQQEhAwJAIAFBARCAgYCAAEUNACABKAIYIRAgAiABQYQBaiILKAIINgLIASACIAspAgA3A8ABIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASAPQQFqNgJUIAEoAlAgD0EDdGoiDyANNgIEIA8gDTYCAAJAIAFBARCAgYCAAEUNACABKAIYIQ8gAiALKAIINgLYASACIAspAgA3A9ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAAkACQCABQQEQgIGAgABFDQAgAkHQAGogARCygICAACACKAJUIQECQCACKAJQQQFxDQAgAUEBEICBgIAARQ0AAkACQCABQQEQgIGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJByABqIAEQsoCAgAAgAigCTCEBAkAgAigCSCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkHAAGogARCygICAACACKAJEIQECQCACKAJAIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgC0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBOGogARDLgICAACACKAI8IQEgAigCOEEBcQ0AIAFBARCAgYCAAEUNACABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgACQAJAIAFBARCAgYCAAEUNACACQTBqIAEQsoCAgAAgAigCNCEBAkAgAigCMEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiAiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyALQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkEYaiABEMyAgIAAIAIoAhwhASACKAIYIQMLAkAgA0EBRw0AIAEgAigCyAE2AowBIAEgAikDwAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQsCQAJAIANBAXFFDQAgAyELDAELIAFBARCAgYCAAEUNACACQRBqIAEQyoCAgAAgAigCFCEBAkAgAigCEEEBcQ0AA0AgAkEIaiABEMqAgIAAIAIoAgwhASACKAIIQQFxRQ0ACwsgAS0ADEECRyELCwJAIAtBAUcNACABLQAMQQJHDQELQQAhCwsCQCALQQFHDQAgASACKAK4ATYCjAEgASACKQOwATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDQJAAkACQAJAAkACQCALQQFHDQAgDUH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgYgASgCJCIDaiILIAhNDQAgCyAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAZLDQIgASAENgIwDAILIA1B/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgZqIgsgCE0NACALIAhrQQFGDQcLAkAgBSAGSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBCToAACABIANBAWo2AjAgAS0AlAEhDQwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBCToAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakEJQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIA1B/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiCy0AAA0BIAsgAzYCBCABKAKMASEGAkAgASgCGCILIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCALQRRsaiIDIAY2AhAgA0EANgIIIAMgBzYCBCADQYESOwEAIAEgC0EBajYCGAwCCyAHIAMjgYCAgABB1N7AgABqEL6CgIAAAAsjgYCAgAAiAUHZmcCAAGpBKCABQeTewIAAahCxgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBCUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHwAWokgICAgAALmBABDn8jgICAgABB4ABrIgIkgICAgABBASEDAkAgAUEBEICBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAIAFBARCAgYCAAEUNACABKAIYIQwgAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQShqIAEQ5YCAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCAgYCAAEUNACABKAIYIQ4gAiABKAKMATYCSCACIAEpAoQBNwNAIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQgIGAgABFDQAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiBBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBGGogARCygICAACACKAIcIQECQCACKAIYIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgABBASELIAFBARCAgYCAAEUNACACQQhqIAEQ6ICAgAAgAigCDCEBAkAgAigCCCILQQFHDQAgAS0ADEECRw0BC0EAIQsLAkAgC0EBRw0AIAEgAigCODYCjAEgASACKQMwNwKEAQJAIAwgASgCGEsNACABIAw2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDIAEtAJQBIQ0CQAJAAkACQAJAAkAgC0EBRw0AIA1B/wFxQQFGDQYgAS0AlQFFDQMgASgCkAEiAyAGRw0BAkAgASgCMCIG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AiAOI4GAgIAAQamcwIAAaiIPLQACOgACIA4gDy8AADsAACACQQM2AjwgAiAONgI4IAJCgICAgDA3AjAgASADIAJBMGogCxCggICAAAsCQAJAAkAgC0UNACABQQEQgIGAgABFDQAgASgCGCEOIAIgDSgCCDYCSCACIA0pAgA3A0AgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgACQCABQQEQgIGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsgAS0ADEECRg0CCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAAC0EBIQsMAQsgAUE0ahCpgICAACACIAEQpYCAgAAgAigCBCEBIAIoAgAhCwsCQCALQQFHDQAgASACKAIoNgKMASABIAIpAyA3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDgJAAkACQAJAIAtBAUcNACAOQf8BcUEBRg0IIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgBksNAiABIAQ2AjAMAgsgDkH/AXFBAUcNBSABLQCVAUUNBgJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiBmoiCyAITQ0AIAsgCGtBAUYNCQsCQCAFIAZLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQcgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEUOgAAIAEgA0EBajYCMCABLQCUASEODAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEUOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEUQQAgCiABKAJ8IAlLGxCigICAAAwBC0EBQQMQooKAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDkH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiILLQAADQEgCyADNgIEIAEoAowBIQYCQCABKAIYIgsgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAtBFGxqIgMgBjYCECADQQA2AgggAyAHNgIEIANBgSg7AQAgASALQQFqNgIYDAILIAcgAyOBgICAAEHU3sCAAGoQvoKAgAAACyOBgICAACIBQdmZwIAAakEoIAFB5N7AgABqELGCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEUQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQdAAaiSAgICAAAuKCQELfyOAgICAAEEgayICJICAgIAAQQEhAwJAIAFBARCAgYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCiACQRhqIAEQ5oCAgAAgAigCHCEBAkACQAJAIAIoAhhBAUcNACACQRBqIAEQroCAgAAgAigCFCEBIAIoAhBBAUcNACACQQhqIAEQqoCAgAAgAigCDCEBIAIoAghBAXENAQtBACELDAELIAIgARCsgICAACACKAIEIQEgAigCACELC0EBIQMgAS0AlAEhDAJAAkACQAJAAkACQCALQQFHDQAgDEH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAxB/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgxqIgYgCE0NACAGIAhrQQFGDQcLAkAgBSAMSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBDToAACABIANBAWo2AjAgAS0AlAEhDAwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBDToAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakENQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIAxB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEMAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAw2AhAgA0EANgIIIAMgBzYCBCADQYEaOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABB1N7AgABqEL6CgIAAAAsjgYCAgAAiAUHZmcCAAGpBKCABQeTewIAAahCxgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBDUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkEgaiSAgICAAAuTKQERfyOAgICAAEHgAWsiAiSAgICAAEEBIQMCQCABQQEQgIGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQoCQAJAAkACQAJAAkACQAJAIAFBARCAgYCAAEUNACABKAIYIQsgAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhAyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkAgAUEBEICBgIAARQ0AIAEoAhghDiACIAFBhAFqIgMoAgg2ApgBIAIgAykCADcDkAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEICBgIAARQ0AIAEoAhghECACIAMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEICBgIAARQ0AIAEoAhghDyACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCAgYCAAEUNACACQfgAaiABEK+AgIAAIAIoAnwhAQJAIAIoAnhBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIREgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHwAGogARCvgICAACACKAJ0IQECQCACKAJwIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghESACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQegAaiABEK+AgIAAIAIoAmwhAQJAIAIoAmgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHgAGogARDJgICAACACKAJkIQEgAigCYCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkAgDEEBRg0AAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASEDIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQgIGAgABFDQBBASEMAkAgAUEBEICBgIAARQ0AIAEoAhghESACIAFBhAFqIgMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIQIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIBBBAWo2AlQgASgCUCAQQQN0aiIQIA02AgQgECANNgIAAkAgAUEBEICBgIAARQ0AIAEoAhghECACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCAgYCAAEUNACACQdgAaiABEK+AgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQgIGAgABFDQACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIRIgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHQAGogARCvgICAACACKAJUIQECQCACKAJQIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBIgASgCGEsNACABIBI2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghEiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQcgAaiABEK+AgIAAIAIoAkwhAQJAIAIoAkgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgEiABKAIYSw0AIAEgEjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHAAGogARDJgICAACACKAJEIQEgAigCQCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkACQCAMQQFxRQ0AIAwhAwwBCyABQQEQgIGAgABFDQAgAkE4aiABEMiAgIAAIAIoAjwhAQJAIAIoAjhBAXENAANAIAJBMGogARDIgICAACACKAI0IQEgAigCMEEBcUUNAAsLIAEtAAxBAkchAwsCQCADQQFHDQAgAS0ADEECRw0BC0EAIQMLAkAgA0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQAgAUEBEICBgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCAgYCAAEUNACACQShqIAEQr4CAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQSBqIAEQr4CAgAAgAigCJCEBAkAgAigCICIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAkEYaiABEK+AgIAAIAIoAhwhAQJAIAIoAhgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQQLIAEtAAxBAkYNAwsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAACyABIAIoAogBNgKMASABIAIpA4ABNwKEAQJAIAsgASgCGEsNACABIAs2AhgLIAFBNGoQqICAgAALAkAgAUEBEICBgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCAgYCAAEUNACACQRBqIAEQr4CAgAAgAigCFCEBAkAgAigCEEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghCyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQQhqIAEQr4CAgAAgAigCDCEBAkAgAigCCCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCALIAEoAhhLDQAgASALNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIQsgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAiABEK+AgIAAIAIoAgQhAQJAIAIoAgAiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgCyABKAIYSw0AIAEgCzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQcLIAEtAAxBAkYNBgsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAAC0EBIQMgAS0AlAFBAUYNByABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAFBNGoiAxCpgICAACADEKmAgIAADAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEFOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEFQQAgCiABKAJ8IAlLGxCigICAAAwBCyABQTRqEKmAgIAADAELIAEtAJQBQQJHDQEgAS0AlQFFDQEgByABKAIYSw0BIAEgBzYCGAwBCwJAAkAgAS0AlAEiA0EBRw0AIAEtAJUBRQ0BAkACQCABKAKQASIDIAZHDQACQCABKAIwIgMgASgCJCIMaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgDEsNACABIAU2AiQLIAQgA0sNASABIAQ2AjAgBCEDDAELIAYgA00NAiABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCKEcNACABQShqEKGAgIAACyABKAIsIANqQQU6AAAgASADQQFqNgIwIAEtAJQBIQMLIANB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEIAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAg2AhAgA0EANgIIIAMgBzYCBCADQYEKOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABB1N7AgABqEL6CgIAAAAsjgYCAgAAiAUHZmcCAAGpBKCABQeTewIAAahCxgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBBUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHgAWokgICAgAAL3xkBD38jgICAgABBoAFrIgIkgICAgABBASEDAkAgAUEBEICBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAIAFBARCAgYCAAEUNACABKAIYIQwgAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdgAaiABEOSAgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQgIGAgABFDQAgASgCGCEOIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdAAaiABELKAgIAAIAIoAlQhAQJAAkAgAigCUEEBcQ0AIAFBARCAgYCAAEUNACABKAIYIQ8gAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQCABQQEQgIGAgABFDQAgAkHIAGogARCygICAACACKAJMIQECQCACKAJIQQFxDQAgAUEBEICBgIAARQ0AAkACQCABQQEQgIGAgAANAEEBIQMMAQsgASgCGCEQIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBwABqIAEQsoCAgAAgAigCRCEBAkAgAigCQCIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCAgYCAAA0AQQEhAwwBCyABKAIYIRAgAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkE4aiABELKAgIAAIAIoAjwhAQJAIAIoAjgiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQMLIAEtAAxBAkYNAgsgASACKAKIATYCjAEgASACKQOAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAACyABIAIoAng2AowBIAEgAikDcDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoiAxCpgICAACADEKmAgIAAIAJBMGogARC1gICAACACKAI0IQEgAigCMEEBcQ0AIAFBARCAgYCAAEUNACABKAIYIQ4gAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCAgYCAAEUNACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCAgYCAAEUNAAJAAkAgAUEBEICBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQSBqIAEQsoCAgAAgAigCJCEBAkAgAigCICIDQQFHDQAgASACKAKY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BEIAUg0BC0EAIQEMAQsjgYCAgABB2qfAgABqQQAjjoCAgAApAwAgBFEbIQFBBCEDCyACIANBCSABGzYCDCACIAEjgYCAgABB3qfAgABqIAEbNgIIAkACQAJAI46AgIAAKQMAIgVCAFINACOBgICAAEGg7cCAAGopAwAhBANAIARCf1ENAiOBgICAAEGg7cCAAGoiASAEQgF8IgUgASkDACIGIAYgBFEiARs3AwAgBiEEIAFFDQALI46AgIAAIAU3AwALIAIgBTcDECACQRhqQQBBgAT8CwAgAkIANwOgBCACQYAENgKcBCOCgICAACEBIAA1AgQhBCACIAJBGGo2ApgEIAA1AgAhBiACIAQgAUGJgICAAGqtQiCGIgWEIgc3A8gEIAIgBiABQYqAgIAAaq1CIIaEIgY3A8AEIAIjj4CAgACtQiCGIAJBEGqthCIINwO4BCACIAUgAkEIaq2EIgU3A7AEIAJB/wE6AKgEIAIgAikDqAQiBDcD0AQjgYCAgAAhASACIAJBmARqNgLYBCACQdAEaiABQZDkwIAAaiABQfuYwIAAaiACQbAEahC0goCAACEBIAItANAEIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACICQdqmwIAAakGtASACQajkwIAAahC1goCAAAALIANB/wFxQQNHDQEgAkHQBGpBBHIQ2IKAgAAMAQsgAiACKQPQBCIENwOoBAsCQAJAAkACQCAEp0H/AXEiAUEDRw0AIAJBqARqQQRyENiCgIAADAELIAFB/wFGDQELIAAoAgxBJGooAgAhASAAKAIIIQAgAiAHNwPIBCACIAY3A8AEIAIgCDcDuAQgAiAFNwOwBCACQdAEaiAAI4GAgIAAQfuYwIAAaiACQbAEaiABEYKAgIAAgICAgAAgAi0A0ARBA0cNASACQdQEahDYgoCAAAwBCyACKAKgBCIBQYAESw0CIAJBsARqIAAoAgggAkEYaiABIAAoAgwoAhwRgoCAgACAgICAACACLQCwBEEDRw0AIAJBtARqENiCgIAACyACQeAEaiSAgICAAA8LEIWBgIAAAAtBACABQYAEI4GAgIAAQYDlwIAAahC2goCAAAALFAAgACgCACAAKAIEIAEQ2oKAgAALnwECA38BfiOAgICAAEEgayICJICAgIAAIAEoAgQhAyABKAIAIQQg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gABBEGsiAiSAgICAAAJAAkACQCABQQhLDQAgASAATQ0BCyACQQA2AgwgAkEMaiABQQQgAUEESxsgABCdgoCAACEBQQAgAigCDCABGyEBDAELIAAQlYKAgAAhAQsgAkEQaiSAgICAACABCwkAEJeBgIAAAAsKACAAEJiCgIAAC50BAQJ/I4CAgIAAQRBrIgQkgICAgAACQAJAAkAgAkEISw0AIAIgA00NAQtBACEFIARBADYCDCAEQQxqIAJBBCACQQRLGyADEJ2CgIAADQEgBCgCDCICRQ0BAkAgAyABIAMgAUkbIgNFDQAgAiAAIAP8CgAACyAAEJiCgIAAIAIhBQwBCyAAIAMQm4KAgAAhBQsgBEEQaiSAgICAACAFCzgCAX8BfiOAgICAAEEQayIBJICAgIAAIAApAgAhAiABIAA2AgwgASACNwIEIAFBBGoQjYGAgAAACw0AIAEgABCkgYCAAAALLwEBfyOAgICAAEEQayICJICAgIAAIAIgATYCDCACIAA2AgggAkEIahCLgYCAAAAL7wECA38BfiOAgICAAEEQayICJICAgIAAIAEoAgQhAyABKAIAIQQgAC0AACEAIAJBBGoQqYGAgAAgAikCCCEFAkAgAigCBCIBQX9HDQAgBUL/AYNCA1INACACQQxqENiCgIAACwJAAkACQAJAIAQjgYCAgABB36rAgABqQREgAygCDCIDEYOAgIAAgICAgAANACAAQQFxDQEgBCOBgICAAEHwqsCAAGpB2AAgAxGDgICAAICAgIAARQ0BC0EBIQQgAUEASg0BDAILQQAhBCABQQBMDQELIAWnIAFBARDzgICAAAsgAkEQaiSAgICAACAEC/ECAQJ/I4CAgIAAQaADayIDJICAgIAAAkACQAJAAkAgAkH/AksNAAJAIAJFDQAgA0EUaiABIAL8CgAACyADQRRqIAJqQQA6AAAgA0GUA2ogA0EUaiACQQFqEL+CgIAAAkAgAygClANBAUcNAEF+IQIgA0F+NgIIIAMjgYCAgABB+OTAgABqKQMANwIMDAILAkAgAygCmAMQiIKAgAAiAUUNAAJAAkAgARCSgoCAACICDQBBASEEDAELEPWAgIAAIAJBARDygICAACIERQ0EIAJFDQAgBCABIAL8CgAACyADIAI2AhAgAyAENgIMIAMgAjYCCAwCC0F/IQIgA0F/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CCAGQQFqIQYgBSACayEFIANBeGoiAw0ACyALIQYLIAcgBkkNBSAJIAZBA3RqIQkCQCAHIAZHDQBBACEHIAVFDQEjgYCAgAAiBUH+qcCAAGpBzwAgBUGc5sCAAGoQtYKAgAAACyAJKAIEIgggBUkNAyAHIAZrIQcgCSAIIAVrNgIEIAkgCSgCACAFajYCAAsCQCAELQAIQQNHDQAgChDYgoCAAAsgBw0ACwsgAEH/AToAAAwECyOBgICAACIFQdupwIAAakHHACAFQYzmwIAAahC1goCAAAALIAggAyADI4GAgIAAQazmwIAAahC2goCAAAALIAYgByAHI4GAgIAAQazmwIAAahC2goCAAAALIAAgBSkCADcCAAsgBEEQaiSAgICAAAtEAAJAIAAoAgBBf0YNACABIAAoAgQgACgCCBDEgoCAAA8LIAEoAgAgASgCBCAAKAIMKAIAIgAoAgAgACgCBBC0goCAAAsbACAAI4GAgIAAQcjnwIAAajYCBCAAIAE2AgALDAAgACABKQIANwMAC1sBAn8gASgCBCECIAEoAgAhAxD1gICAAAJAQQhBBBDygICAACIBDQBBBEEIEKWCgIAAAAsgASACNgIEIAEgAzYCACAAI4GAgIAAQcjnwIAAajYCBCAAIAE2AgALDwAgACgCACABENmCgIAACxQAIAEgACgCACAAKAIEEMSCgIAAC5MBAQF/AkBBAiACIANBECADQRBJGxDcgYCAACIDQX9HDQAjgYCAgAAhAyOUgICAACgCACECI5WAgIAAKAIAIQQCQCACIANB4OXAgABqRg0AI4GAgIAAQeDlwIAAahDTgoCAAAsgAEEAOwABIAAgBDYCBCAAQQA6AAAgAEEDakEAOgAADwsgAEH/AToAACAAIAM2AgQLBABBAQsKACAAQf8BOgAAC4sBAQF/AkBBAiACIAMQ3YGAgAAiA0F/Rw0AI4GAgIAAIQMjlICAgAAoAgAhAiOVgICAACgCACEEAkAgAiADQeDlwIAAakYNACOBgICAAEHg5cCAAGoQ04KAgAALIABBADsAASAAIAQ2AgQgAEEAOgAAIABBA2pBADoAAA8LIABB/wE6AAAgACADNgIEC/sCAQV/AkACQCADDQBBACEEDAELIANBA3EhBUEAIQZBACEEAkACQCADQQRJDQAgAkEcaiEHIANB/P///wBxIQhBACEEQQAhBgNAIAcoAgAgB0F4aigCACAHQXBqKAIAIAdBaGooAgAgBGpqamohBCAHQSBqIQcgCCAGQQRqIgZHDQALIAVFDQELIAZBA3QgAmpBBGohBwNAIAcoAgAgBGohBCAHQQhqIQcgBUF/aiIFDQALCyADQQN0IQcCQCAEIAEoAgAgASgCCCIFa00NACABIAUgBEEBQQEQkIGAgAALIAIgB2ohAyABKAIAIQggASgCCCEFA0AgAigCACEGAkACQAJAIAJBBGooAgAiByAIIAVrTQ0AIAEgBSAHQQFBARCQgYCAACABKAIAIQggASgCCCEFDAELIAdFDQELIAdFDQAgASgCBCAFaiAGIAf8CgAACyABIAUgB2oiBTYCCCACQQhqIgIgA0cNAAsLIABB/wE6AAAgACAENgIECwQAQQEL7gIBBX8CQCADRQ0AIANBA3EhBEEAIQVBACEGAkACQCADQQRJDQAgAkEcaiEHIANB/P///wBxIQhBACEFQQAhBgNAIAcoAgAgB0F4aigCACAHQXBqKAIAIAdBaGooAgAgBmpqamohBiAHQSBqIQcgCCAFQQRqIgVHDQALIARFDQELIAVBA3QgAmpBBGohBwNAIAcoAgAgBmohBiAHQQhqIQcgBEF/aiIEDQALCyADQQN0IQcCQCAGIAEoAgAiBSABKAIIIgRrTQ0AIAEgBCAGQQFBARCQgYCAACABKAIAIQUgASgCCCEECyACIAdqIQgDQCACKAIAIQYCQAJAAkAgAkEEaigCACIHIAUgBGtNDQAgASAEIAdBAUEBEJCBgIAAIAEoAgAhBSABKAIIIQQMAQsgB0UNAQsgB0UNACABKAIEIARqIAYgB/wKAAALIAEgBCAHaiIENgIIIAJBCGoiAiAIRw0ACwsgAEH/AToAAAsKACAAQf8BOgAAC2sBAX8CQAJAAkAgAyABKAIAIAEoAggiBGtNDQAgASAEIANBAUEBEJCBgIAAIAEoAgghBAwBCyADRQ0BCyADRQ0AIAEoAgQgBGogAiAD/AoAAAsgACADNgIEIABB/wE6AAAgASAEIANqNgIIC2QBAX8CQAJAAkAgAyABKAIAIAEoAggiBGtNDQAgASAEIANBAUEBEJCBgIAAIAEoAgghBAwBCyADRQ0BCyADRQ0AIAEoAgQgBGogAiAD/AoAAAsgAEH/AToAACABIAQgA2o2AggLngIBBn8gACgCCCECAkACQCABQYABTw0AQQEhAwwBCwJAIAFBgBBPDQBBAiEDDAELQQNBBCABQYCABEkbIQMLAkAgAyAAKAIAIAJrTQ0AIAAgAiADQQFBARCQgYCAAAsgACgCBCACaiEEAkACQCABQYABSQ0AIAFBP3FBgH9yIQUgAUEGdiEGAkAgAUGAEE8NACAEIAU6AAEgBCAGQcABcjoAAAwCCyABQQx2IQcgBkE/cUGAf3IhBgJAIAFB//8DSw0AIAQgBToAAiAEIAY6AAEgBCAHQeABcjoAAAwCCyAEIAU6AAMgBCAGOgACIAQgB0E/cUGAf3I6AAEgBCABQRJ2QXByOgAADAELIAQgAToAAAsgACADIAJqNgIIQQALXgEBfwJAAkACQCACIAAoAgAgACgCCCIDa00NACAAIAMgAkEBQQEQkIGAgAAgACgCCCEDDAELIAJFDQELIAJFDQAgACgCBCADaiABIAL8CgAACyAAIAMgAmo2AghBAAuvAQICfwF+I4CAgIAAQSBrIgIkgICAgAACQCABKAIAQX9HDQAgASgCDCEDIAJBADYCHCACQoCAgIAQNwIUIAJBFGojgYCAgABBkOXAgABqIAMoAgAiAygCACADKAIEELSCgIAAGiACIAIoAhwiAzYCECACIAIpAhQiBDcDCCABIAM2AgggASAENwIACyAAIAE2AgAgACOBgICAAEHY58CAAGo2AgQgAkEgaiSAgICAAAuTAgICfwF+I4CAgIAAQSBrIgIkgICAgAACQCABKAIAQX9HDQAgASgCDCEDIAJBADYCGCACQoCAgIAQNwIQIAJBEGojgYCAgABBkOXAgABqIAMoAgAiAygCACADKAIEELSCgIAAGiACIAIoAhgiAzYCCCACIAIpAhAiBDcDACABIAM2AgggASAENwIACyABKAIIIQMgAUEANgIIIAEpAgAhBCABQoCAgIAQNwIAIAIgAzYCGCACIAQ3AxAQ9YCAgAACQEEMQQQQ8oCAgAAiAQ0AQQRBDBClgoCAAAALIAEgAigCGDYCCCABIAIpAxA3AgAgACOBgICAAEHY58CAAGo2AgQgACABNgIAIAJBIGokgICAgAALuQEBAX8jgICAgABBEGsiBCSAgICAACAAQf8BOgAAIAQgATYCCCAEIAApAgA3AwAgBCOB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IAAoAhAgA0EgaiADQShqEPWBgIAADQAMBAsLIAMoAiwQ54GAgABBHSEGCyOVgICAACAGNgIAQX8hBgwCCyADKQMgIgSnIgZBAUgNASAAKAIAIgdFDQEgByAHKQMAIARC/////weDfDcDAAwBC0HAACEGAkAgAy0AKEEBRg0AIAMoAiwQ54GAgABBHSEGCyOVgICAACAGNgIAQX8hBgsgA0EwaiSAgICAACAGC3sBAn8CQCAAKAIEIgFFDQAgACgCACICIQADQAJAIABBBGooAgBFDQAgACgCABCYgoCAAAsgAEIANwIAAkAgAEEMaigCAEUNACAAQQhqKAIAEJiCgIAACyAAQQhqQgA3AgAgAEEQaiEAIAFBf2oiAQ0ACyACEJiCgIAACwsKACAAEIGAgIAACwoAIAAQgoCAgAALBAAgAAsYAAJAIAAoAgRFDQAgACgCABCYgoCAAAsLCgAgABCDgICAAAsEACAACwoAIAAQhICAgAALBAAgAAsKACAAEIWAgIAACwoAIAAQhoCAgAALNQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQh4CAgAAgACABKQIINwIAIAFBEGokgICAgAALDgAgAC0AABCIgICAAAALCgAgABCJgICAAAs/AQF/I4CAgIAAQRBrIgIkgICAgAAgACgCACAAKAIEIAJBCGoQioCAgAAgASACKQIINwIAIAJBEGokgICAgAALdwIBfwF+I4CAgIAAQRBrIgMkgICAgAAgACADEIuAgIAAAkACQAJAAkAgAy0AAA4CAAIBCyADKQMIIQQLIAEgBDcDAEEBIQAMAQsgAiADNQIMQiCGQgAgAzEACCIEUBsgBIQ3AgBBACEACyADQRBqJICAgIAAIAALXAEBfyOAgICAAEEQayIDJICAgIAAIAAgASgCACABKAIEIANBBGoQjICAgAACQCADLQAEQQFHIgENACACIAMtAAg6AAAgAiADKAIMNgIECyADQRBqJICAgIAAIAELUgEBfyOAgICAAEEQayICJICAgIAAIAAgAkEEahCNgICAAAJAIAItAARBAUciAA0AIAEgAi0ACDoAACABIAIoAgw2AgQLIAJBEGokgICAgAAgAAsKACAAEI6AgIAACwgAEI+AgIAACwgAEJCAgIAACwgAEJGAgIAAC0EBAX8jgICAgABBEGsiASSAgICA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IAFBIEkNDSABQYF/akEhSQ0NIAFBgMB8akGAMkkNDSABQYCARGpB/v8DSQ0NIAFBIEYNDSABQYCAQGpB/v8DSQ0NIAFBhQFJDQsgARC6goCAAA0NAkAgAUGABkkNACACQQFxDQgLIAFBrAFLDQgMCwsgAEIANwECIABB3LgBOwEADAkLIABCADcBAiAAQdzcATsBAAwICyAAQgA3AQIgAEHc6AE7AQAMBwsgAEIANwECIABB3OQBOwEADAYLIABCADcBAiAAQdzgADsBAAwFCyACQYACcUUNBiAAQgA3AQIgAEHczgA7AQAMBAsgAkH///8HcUGAgARPDQIMBQsgARC7goCAAA0FCyABELyCgIAADQQgARC9goCAAEUNAgwECyAAQgA3AQIgAEHcxAA7AQALQQIhAUEAIQIMAwsgARC4goCAAEUNAQsgACABNgIAQYEBIQFBgAEhAgwBCyADQQA6AAggA0EAOwEGIAMjgYCAgABB28/AgABqIgQgAUEUdmotAAA6AAkgAyAEIAFBBHZBD3FqLQAAOgANIAMgBCABQQh2QQ9xai0AADoADCADIAQgAUEMdkEPcWotAAA6AAsgAyAEIAFBEHZBD3FqLQAAOgAKIANBBmogAUEBcmdBAnYiAmoiBUH7ADoAACAFQX9qQfUAOgAAIANBBmogAkF+aiICakHcADoAACAAIAMpAQY3AgAgA0H9ADoADyADIAQgAUEPcWotAAA6AA4gACADLwEOOwEIQQohAQsgACABOgANIAAgAjoADCADQRBqJICAgIAAC2wBAX9BASEBAkACQCAAQfgGSQ0AIABB/v8PSQ0BIABBgYA4Rg0AIABB4P9HakHgAEkNACAAQYD+R2pB8AFJDQAgAEGAgERqQf7/A0kNACAAQYCAQGpB/v8DSSEBCyABDwsgABC5goCAAEEBcwvsAgEFf0EAIQEjgYCAgABB/NnAgABqIgIgAkEAQRsgAEH85QZJGyIDIANBDWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBB2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAmoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQbULIQQCQAJAIANBNEsNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQdm9wIAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuJAQECf0EAIQECQAJAAkACQAJAIABBCHYiAkFqag4bAAQEBAQEBAQEBAMEBAQEBAQEBAQEBAQEBAQBAgsgAEGALUYhAQwDCyAAQYDgAEYhAQwCCyACDQEjg4CAgAAgAEH/AXFqLQAAIQEMAQsjg4CAgAAgAEH/AXFqLQAAQQJxQQF2IQELIAFBAXEL7AIBBX9BACEBI4GAgIAAQdTbwIAAaiICIAJBAEEQIABBq50ESRsiAyADQQhyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQRyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkH/BSEEAkACQCADQR9LDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEGOycCAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELrwIBBX9BACEBI4GAgIAAQdjcwIAAaiICIAJBAEEGIABBgPwDSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkEjIQQCQAJAIANBCksNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEB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AXRqLwAAOwAAIANBfGohAyAAQf+s4gRLDQALCwJAAkAgBUEJSw0AIAUhAAwBCyACQQZqIANBfmoiA2ojgYCAgABBs9bAgABqIAUgBUH//wNxQeQAbiIAQeQAbGtB//8DcUEBdGovAAA7AAALAkACQCAERQ0AIABFDQELIAJBBmogA0F/aiIDaiOBgICAAEGz1sCAAGogAEEBdGotAAE6AAALIAFBAUEBQQAgAkEGaiADakEKIANrEMCCgIAAIQMgAkEQaiSAgICAACADCxMAIAAgASACIAMgBBDHgoCAAAAL/woCBH8BfiOAgICAAEEwayIFJICAgIAAIAUgAzYCBCAFIAI2AgAgBSABNgIIAkACQAJAAkACQAJAAkACQCACIAFLIgYNACADIAFLIgcNASACIANLDQIgAkUNBCACIAFPDQQgACACaiwAAEG/f0oNBAJAIAAgAkF/aiIIaiwAAEG/f0oNACACQX5qIgMgAkF9aiAAIANqLAAAQb9/ShshCAsgASACQQFqIgMgASADSxshByACIAEgBhshAwNAAkACQCADIAJGDQAgACACaiwAAEG/f0wNAQwGCyADIAEjgYCAgABBxOrAgABqEL6CgIAAAAsgAkEBaiICIAFJDQALIAchAgwDCyAFI5CAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQbaBwIAAaiAFQRhqIAQQtYKAgAAACyAFI5CAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBUEEaq2ENwMYI4GAgIAAQfOBwIAAaiAFQRhqIAQQtYKAgAAACyAFI5CAgIAArUIghiIJIAVBBGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQbCAwIAAaiAFQRhqIAQQtYKAgAAACyAFIAg2AgwgBSACNgIQAkAgCCACSw0AIAIgAUsNAAJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAgsgAiABRg0AIAAgAmosAABBv39MDQELIAggAkYNAgJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSObgICAAK1CIIYgBUEUaq2ENwMgIAUjkICAgACtQiCGIAWthDcDGCAFI4KAgIAAQcuAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQbaVwIAAaiAFQRhqIAQQtYKAgAAACyAAIAEgCCACIAQQxoKAgAAACyADRQ0CIAMgAU8NAiAAIANqLAAAQb9/Sg0CAkAgACADQX9qIghqLAAAQb9/Sg0AIANBfmoiAiADQX1qIAAgAmosAABBv39KGyEICyABIANBAWoiAiABIAJLGyEGIAMgASAHGyECAkADQAJAAkAgAiADRg0AIAAgA2osAABBv39MDQEMAwsgAiABI4GAgIAAQcTqwIAAahC+goCAAAALIANBAWoiAyABSQ0ACyAGIQMLIAUgCDYCDCAFIAM2AhAgCCADSw0BIAMgAUsNAQJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAwsgAyABRg0AIAAgA2osAABBv39MDQILIAggA0YNAAJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSObgICAAK1CIIYgBUEUaq2ENwMgIAUjkICAgACtQiCGIAVBBGqthDcDGCAFI4KAgIAAQcuAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQYiWwIAAaiAFQRhqIAQQtYKAgAAACyAEEMqCgIAAAAsgACABIAggAyAEEMaCgIAAAAsgBSOQgICAAK1CIIYiCSAFQQhqrYQ3AyAgBSAJIAVBBGqthDcDGCOBgICAAEHzgcCAAGogBUEYaiAEELWCgIAAAAvIAQEEfyOAgICAAEEQayICJICAgIAAQQEhAwJAIAEoAgAiBEEnIAEoAgQiBSgCECIBEYSAgIAAgICAgAANACACIAAoAgBBgQIQt4KAgAACQAJAIAItAA0iA0GBAUkNACAEIAIoAgAgARGEgICAAICAgIAARQ0BQQEhAwwCCyAEIAIgAi0ADCIAaiADIABrIAUoAgwRg4CAgACAgICAAEUNAEEBIQMMAQsgBEEnIAERhICAgACAgICAACEDCyACQRBqJICAgIAAIAMLhgUBA38jgICAgABBEGsiAiSAgICAAAJAAkACQAJAIAEoAggiA0GAgIAQcQ0AIANBgICAIHENASAAIAEQxYKAgABFDQJBASEEDAMLIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQdvPwIAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABBgt7AgABqQQIgAkEIaiADakEIakEAIANrEMCCgIAARQ0BDAILIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQYTewIAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABBgt7AgABqQQIgAkEIaiADakEIakEAIANrEMCCgIAADQELI4GAgIAAIQMCQCABKAIAIANBgN7AgABqQQIgASgCBCgCDBGDgICAAICAgIAARQ0AQQEhBAwBCyAAQQRqIQMCQAJAIAEoAggiBEGAgIAQcQ0AIARBgICAIHENASADIAEQxYKAgAAhBAwCCyADKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEHbz8CAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0ACyABQQEjgYCAgABBgt7AgABqQQIgAkEIaiADakEIakEAIANrEMCCgIAAIQQMAQsgAygCACEEQQAhAwNAIAJBCGogA2pBB2ojgYCAgABBhN7AgABqIARBD3FqLQAAOgAAIANBf2ohAyAEQQR2IgQNAAsgAUEBI4GAgIAAQYLewIAAakECIAJBCGogA2pBCGpBACADaxDAgoCAACEECyACQRBqJICAgIAAIAQLGgAjgYCAgABB/dXAgABqQSsgABCxgoCAAAALWAEBfyOAgICAAEEQayIDJICAgIAAIAMgATYCBCADIAA2AgAgAyOCgICAAEHJgICAAGqtQiCGIAOthDcDCCOBgICAAEHhhMCAAGogA0EIaiACELWCgIAAAAuBAQEBfyOAgICAAEEgayIFJICAgIAAIAUgATYCBCAFIAA2AgAgBSADNgIMIAUgAjYCCCAFI4KAgIAAIgFByICAgABqrUIghiAFQQhqrYQ3AxggBSABQcmAgIAAaq1CIIYgBa2E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IgAgACgCDBGGgICAAICAgIAACzsAAkAgAC0AAA0AIAEjgYCAgABBlN7AgABqQQUQw4KAgAAPCyABI4GAgIAAQZnewIAAakEEEMOCgIAACw4AIAIgACABEMOCgIAACwQAQQALBABBAAsEAEErCwvDbAIAQYCAwAAL0F7AATrAATrAABZzbGljZSBpbmRleCBzdGFydHMgYXQgwA0gYnV0IGVuZHMgYXQgwAAVYnl0ZSByYW5nZSBzdGFydHMgYXQgwA0gYnV0IGVuZHMgYXQgwAAgaW5kZXggb3V0IG9mIGJvdW5kczogdGhlIGxlbiBpcyDAEiBidXQgdGhlIGluZGV4IGlzIMAAwAUsIG9yIMAAwAQgb3IgwADACSBhdCBsaW5lIMAIIGNvbHVtbiDAABFzdGFydCBieXRlIGluZGV4IMAnIGlzIG91dCBvZiBib3VuZHMgZm9yIHN0cmluZyBvZiBsZW5ndGggwAAPZW5kIGJ5dGUgaW5kZXggwCcgaXMgb3V0IG9mIGJvdW5kcyBmb3Igc3RyaW5nIG9mIGxlbmd0aCDAABJyYW5nZSBzdGFydCBpbmRleCDAIiBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDAABByYW5nZSBlbmQgaW5kZXggwCIgb3V0IG9mIHJhbmdlIGZvciBzbGljZSBvZiBsZW5ndGggwAALdW5leHBlY3RlZCDAAAt1bmV4cGVjdGVkIMALOyBleHBlY3RlZCDAAAlleHBlY3RlZCDAABBhc3NlcnRpb24gYGxlZnQgwBcgcmlnaHRgIGZhaWxlZAogIGxlZnQ6IMAJCiByaWdodDogwAAQYXNzZXJ0aW9uIGBsZWZ0IMAQIHJpZ2h0YCBmYWlsZWQ6IMAJCiAgbGVmdDogwAkKIHJpZ2h0OiDAABVtZXJtYWlkIHBhcnNlIGVycm9yOiDAAMACOiDAABV7ImVycm9yIjoic2VyaWFsaXplOiDAAiJ9AC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvaW8vZXJyb3IvdW5peC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pbmRleC5ycwAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE3LjEvc3JjL3Jhdy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc2hhcmVkL3NtYWxsc29ydC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3N0YWJsZS9xdWlja3NvcnQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlycy5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvdHlwZXMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL211dGV4L25vX3RocmVhZHMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL3J3bG9jay9ub190aHJlYWRzLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHIucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvZXJyb3IucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvaXRlcmF0b3JzL3BhaXIucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvcG9zaXRpb24ucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9pby93cml0ZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL3BhcnNlcl9zdGF0ZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc3RyL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2lkLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UvcmVwcl9pb3ZlYy5ycwDAAToALwARc3RhcnQgYnl0ZSBpbmRleCDAJiBpcyBub3QgYSBjaGFyIGJvdW5kYXJ5OyBpdCBpcyBpbnNpZGUgwAggKGJ5dGVzIMALIG9mIHN0cmluZykAD2VuZCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQDACyAob3MgZXJyb3IgwAEpABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDARyBieXRlcyBmYWlsZWQKc2tpcHBpbmcgYmFja3RyYWNlIHByaW50aW5nIHRvIGF2b2lkIHBvdGVudGlhbCByZWN1cnNpb24KADVmYXRhbCBydW50aW1lIGVycm9yOiBmYWlsZWQgdG8gaW5pdGlhdGUgcGFuaWMsIGVycm9yIMALLCBhYm9ydGluZwoAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMAOIGJ5dGVzIGZhaWxlZAoADHBhbmlja2VkIGF0IMACOgrAMwp0aHJlYWQgcGFuaWNrZWQgd2hpbGUgcHJvY2Vzc2luZyBwYW5pYy4gYWJvcnRpbmcuCgAJCnRocmVhZCAnwAMnICjADikgcGFuaWNrZWQgYXQgwAI6CsABCgAZYWJvcnRpbmcgZHVlIHRvIHBhbmljIGF0IMACOgrAAQoAdW5rbm93biBwYXJzaW5nIGVycm9yaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZWZhdGFsIHJ1bnRpbWUgZXJyb3I6IEF0dGVtcHRlZCB0byBpbml0aWFsaXplIHRocmVhZC1sb2NhbCB3aGlsZSBpdCBpcyBiZWluZyBkcm9wcGVkLCBhYm9ydGluZwoA//////////9hdHRlbXB0IHRvIGpvaW4gaW50byBjb2xsZWN0aW9uIHdpdGggbGVuID4gdXNpemU6Ok1BWGNhbGwgbGltaXQgcmVhY2hlZHN0YWNrIGxpbWl0IHJlYWNoZWRUREJUTFJSTHJlY3Ryb3VuZGVkZGlhbW9uZGNpcmNsZWlkbGFiZWxzaGFwZWFycm93bGluZXNvdXJjZXRhcmdldGVkZ2VUeXBla2luZHZhcmlhbnRkaXJlY3Rpb25ub2Rlc2VkZ2VzLS0+Z3JhcGhmbG93Y2hhcnRtaWQgPiBsZW5wb3NpdGlvbiBvdXQgb2YgYm91bmRzwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrTIAAAaAQAAyB8IMABCsgAAAMgfCDICAABCsgAAAMgfArIAAADID0gyAkAAEZvcm1hdHRpbmcgYXJndW1lbnQgb3V0IG9mIHJhbmdlwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrIAAAHIHwgLi4uCtsgAABoBAAGAAMgfCDAAQrIAAADIHwgyAgAAQrIAAADIHwKyAAAAyA9IMgJAADABC0tPiDAwAE6wAEKyAAAAyB8CsgCAAMgfCDIBAABCsgAAAMgfCDIBQABCsgAAAMgfArIAAADID0gyAYAAEVPSWZpbGVkaWFncmFta3dzdG10c3N0bXRzdG10X2lubmVyY29tbWVudGNoYWlubm9kZWRlZm5yZWZuaWRjaXJjcm5kZGlhbXN0eHRlZGdlYXJyX2xibGFycmxuX2xibGxubGJsbHR4dHNwbmxmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyAAAAAwQHAgkFBAoHBQcEAwUEBAMEBAQHAwYCAwQCAnV1dXV1dXV1YnRudWZydXV1dXV1dXV1dXV1dXV1dXV1AAAiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMTIzNDU2Nzg5YWJjZGVmRU9GIHdoaWxlIHBhcnNpbmcgYSBsaXN0RU9GIHdoaWxlIHBhcnNpbmcgYW4gb2JqZWN0RU9GIHdoaWxlIHBhcnNpbmcgYSBzdHJpbmdFT0Ygd2hpbGUgcGFyc2luZyBhIHZhbHVlZXhwZWN0ZWQgYDpgZXhwZWN0ZWQgYCxgIG9yIGBdYGV4cGVjdGVkIGAsYCBvciBgfWBleHBlY3RlZCBpZGVudGV4cGVjdGVkIHZhbHVlZXhwZWN0ZWQgYCJgaW52YWxpZCBlc2NhcGVpbnZhbGlkIG51bWJlcm51bWJlciBvdXQgb2YgcmFuZ2VpbnZhbGlkIHVuaWNvZGUgY29kZSBwb2ludGNvbnRyb2wgY2hhcmFjdGVyIChcdTAwMDAtXHUwMDFGKSBmb3VuZCB3aGlsZSBwYXJzaW5nIGEgc3RyaW5na2V5IG11c3QgYmUgYSBzdHJpbmdpbnZhbGlkIHZhbHVlOiBleHBlY3RlZCBrZXkgdG8gYmUgYSBudW1iZXIgaW4gcXVvdGVzZmxvYXQga2V5IG11c3QgYmUgZmluaXRlIChnb3QgTmFOIG9yICsvLWluZilsb25lIGxlYWRpbmcgc3Vycm9nYXRlIGluIGhleCBlc2NhcGV0cmFpbGluZyBjb21tYXRyYWlsaW5nIGNoYXJhY3RlcnN1bmV4cGVjdGVkIGVuZCBvZiBoZXggZXNjYXBlcmVjdXJzaW9uIGxpbWl0IGV4Y2VlZGVk4pCN4pCKYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3RmaWxlIG5hbWUgY29udGFpbmVkIGFuIHVuZXhwZWN0ZWQgTlVMIGJ5dGVtYWluPHVubmFtZWQ+bm90ZTogcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPTFgIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGRpc3BsYXkgYSBiYWNrdHJhY2UKAAAAXPbpX9wC9rnxwXBs8mHBJA8nZvGiFQSKTKfz/XYC33FmYXRhbCBydW50aW1lIGVycm9yOiByd2xvY2sgbG9ja2VkIGZvciB3cml0aW5nLCBhYm9ydGluZwpyd2xvY2sgb3ZlcmZsb3dlZCByZWFkIGxvY2tzUlVTVF9CQUNLVFJBQ0VjYW5ub3QgcmVjdXJzaXZlbHkgYWNxdWlyZSBtdXRleGFkdmFuY2luZyBJb1NsaWNlIGJleW9uZCBpdHMgbGVuZ3RoYWR2YW5jaW5nIGlvIHNsaWNlcyBiZXlvbmQgdGhlaXIgbGVuZ3RoAEJveDxkeW4gQW55PnRocmVhZCBjYXVzZWQgbm9uLXVud2luZGluZyBwYW5pYy4gYWJvcnRpbmcuCnN0YWNrIGJhY2t0cmFjZToKbm90ZTogU29tZSBkZXRhaWxzIGFyZSBvbWl0dGVkLCBydW4gd2l0aCBgUlVTVF9CQUNLVFJBQ0U9ZnVsbGAgZm9yIGEgdmVyYm9zZSBiYWNrdHJhY2UuCmZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXJzdHJlcnJvcl9yIGZhaWx1cmVmYWlsZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIHRocmVhZCBJRDogYml0c3BhY2UgZXhoYXVzdGVkcndsb2NrIGhhcyBub3QgYmVlbiBsb2NrZWQgZm9yIHJlYWRpbmciAQgJKw0rKyscKysGAgMeKysaDCsbBCsrJyMUKSsPEiggKyshCisFKCsrACsrKyYrKxgkBw4QKyskKysrKwELKysrKxEZKxMWHR9IYXNoIHRhYmxlIGNhcGFjaXR5IG92ZXJmbG93U3VjY2VzcwBJbGxlZ2FsIGJ5dGUgc2VxdWVuY2UARG9tYWluIGVycm9yAFJlc3VsdCBub3QgcmVwcmVzZW50YWJsZQBOb3QgYSB0dHkAUGVybWlzc2lvbiBkZW5pZWQAT3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWQATm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQBObyBzdWNoIHByb2Nlc3MARmlsZSBleGlzdHMAVmFsdWUgdG9vIGxhcmdlIGZvciBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFF1b3RhIGV4Y2VlZGVkAE11bHRpaG9wIGF0dGVtcHRlZABDYXBhYmlsaXRpZXMgaW5zdWZmaWNpZW50AAAAAAAAAAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gXvv71jYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90RXJyb3ICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIGBAcBAQEUAQABJgIyAgMBNwgbBAYLAAE8AmUOOwIxAg8BHAIBAQsFIgXtAQgCAgIWAQcBAQMEAgkCAgIECAEEAgEFAhkCAwEGBAICFgEHAQIBAgECAgEBBQQCAgMDAQcEAQEHEQoDAQkBAwEWAQcBAgEFAgoBAwEDAgEPBAIMBwcBAwEIAgICFgEHAQIBBQIJAgICAwcDBAIBBQISCgIBBgMDAQQDAgEBAQIDAgMDAwwEBQMDAQQCAQYBDhUFDQEDARcBEAIJAQMBBAcCAQMBAgIEAgoHFgEDARcBCgEFAgkBAwEEBwIFAwEEAgoBAwwNAQMBMwEDAQYEEAIaAQMBEgMYAQkBAQIHAwEEBgEBAQgGCgIDDDoEHSUCAQEBBQEYAQEBFwIFAQEBBwEKAgQgSAEkBCcBJAEPAQ0lxgEBBQECAAEEAgcBAQEEAikBBAIhAQQCBwEBAQQCDwE5AQQCQwIgAxoGVgIGAgADWQcWCRgJFAwNAQMBAgxeAgoGCgYaBlkHKwVGCh8BDAQMBAEDKgIFCywEGgYLAz4CQQEdAgsGCgYOAi4CDBRNAaYIPAMPAz4FKwILCCsFAAIGAiYCBgIIAQEBAQEBAR8CNQEPAQ4CBgETAgMBCQFlAQwCGwENAyIOIQ+MBAAWCxUAAgAFLQEBBQECOAcCDhgJBwEHAQcBBwEHAQcBBwEHAX4iGgFZDNYaUAFWAmcFKwFeAVYJMAEAAzcJABS4CN0UPAMKBjgIRggMBnQLHgNOAQsEIQE3CQ4CCgJnGBwKBgIGAgYJBwEHATwEfgIKBgAMFwQxBAACaiYHDAUFGgEFAQEBAgECAQAgKgYzARMBBAQFAYcCAQG+AwYCBgIGAgMDBwEHCgUCDAEaARMBAgEPAg4iewUDBC0DWAENAwEvLoIdAzEPHAQkCR4FKwUeASUEDiqeAgoGJAQkBCgINAsMAQ8BBwECAQsBDwEHAQIDNAwACRYKCBgGASoBCUUGAgEBLAECAwECFwFICAkwEwECBSEDGwUbJjgEFAIyAQIFCAEDAR0CAwQKBwkHQCAnBAwJNgMdAhsFGgcEDAdQSTczDTMHLggKBiYDHQgC0B8BKgEDAgIQBggJIS4IKhYaJhwUFwlOBCQJRAoBAhkHCgY1ARIIJwlgARQLEgEvPgcBAQEEAQ8BCwY7BQoGBAEIAgICFgEHAQIBBQEKAgICAwIBBgEFBwIHAwULCgEBAgEBJgEKAQECAQEEAQoBAggCHVwBBR5ICAqmNgImIkULCgYNEzoGCgYUHBsCDwQXuTxkUwwIAgECCAECAR4BAgIMCQpGCAIuAgsbSAhTDUkHClYIWCIOCgYJAS0BDgodAyACFgEOSQcBAgEsAwEBAgEJCAoGBgECASUBAgEGBwoGLAQK9hkHEQEpAx1VAQ8yDQBmbwEFC8QAYw0ACgAFAAA6AAAHHwEKBFEBCgYeAgYKRgoKAQcBFQUTADrGWwUZAhksSwQ5BxFABQsHCQApIGFzAAQBBwECAQAPAR0DAgEOBAgAAGsFDQMJBwoCCAD9AwAGFw8RDy4CFwl0PPYKJwLCFUZ6FAwUDFcJGYdVAUcBAgIBAgICBAEMAQEBBwFBAQQCCAEHARwBBAEFAQEDBwEAAgACAA8FAQ8AHwYG1QcBEQIHAQIBBQU+IQFwLQMOAgoEAgAfEToFAQAq1isEAcAfARYIAuAHAQQBAgEPAcUCEClMBAoEAgBETD3CBAEbAQIBAQIBAQoBBAEBAQEGAQQBAQEBAQEDAQIBAQIBAQEBAQEBAQEBAgEBAgQBBwEEAQQBAQEKAREFAwEFARE0AgAsBGQMDwIPAQ8BJQquOB0NLAQJBwIOBpoAAxEDDQPaBgwEAQ8MBDgICgYoCB4CDAQCDgknAAgOAg0DCwM5AQEEEAIMBAoHkwFnAAAgAAIAAgAPAAAAAAAFAAAAAHAABwAtAQEBAgECAQFICzAVEAFlBwIGAgIBBCMBHhtbCzoJCQEYBAEJAQMBBSsDOwkqGAEgNwEBAQQIBAEDBwoCHQE6AQEBAgQIAQkBCgIaAQICOQEEAgQCAgMDAR4CAwELAjkBBAUBAgQBFAIWBgEBOgEBAgEECAEHAwoCHgE7AQEBDAEJASgBAwE3AQEDBQMBBAcCCwIdAToBAgIBAQMDAQQHAgsCHAI5AgEBAgQIAQkBCgIdAUgBBAECAwEBCAFRAQIHDAhiAQIJCwdJAhsBAQEBATcOAQUBAgULASQJAWYEAQYBAgICGQIEAxAEDQECAgYBDwEAAwAEHAMdAh4CQAIBBwgBAgsJAS0DAQF1AiIBdgMEAgkBBgPbAgIBOgEBBwEBAQECCAYKAgEwLgIMFAQwCgQDJgkMAiAEAgY4AQECAwEBBTgIAgKYAwENAQcEAQYBAwLGQAABwyEAA40BYCAABmkCAAQBCiACUAIAAQMBBAEZAgUBlwIaEg0BJggZCwEBLAMwAQIEAgICASQBQwYCAgICDAEIAS8BMwEBAwICBQIBASoCCAHuAQIBBAEAAQAQEBAAAgAB4gGVBQADAQIFBCgDBAGlAgAEQQUAAk0GRgsxBHsBNg8pAQICCgMxBAICBwE9AyQFAQg+AQwCNAkBAQgEAgFfAwIEBgECAZ0BAwgVAjkCAQEBAQwBCQEOBwMFQwECBgEBAgEBAwQDAQEOAlUIAgMBARcBUQECBgEBAgEBAgEC6wECBAYCAQIbAlUIAgEBAmoBAQECCGUBAQECBAEFAAkBAvUBCgQEAZAEAgIEASAKKAYCBAgBCQYCAy4NAQLGAQEDAQHJBwEGAQFSFgIHAQIBAnoGAwEBAgEHAQFIAgMBAQEAAgsCNAUFAxcBAAEGDwAMAwMABTsHAAE/BFEBCwIAAgAuAhcABQMGCAgCBx4ElAMANwQyCAEOARYFAQ8ABwERAgcBAgEFZAGgBwABPQQABP4C8wECAQcCBQEAB20HAGCA8ACtAQABAAEAAgACVQUABRoFMRAAAQAQ7wGgAU8JAAQACAAAAK0BAAYWAcABMQEAAlABAAEABRoFMQUBCgAB+QMAAQ8BABAABAAIAAEeYAAwMTIzNDU2Nzg5YWJjZGVmZW50aXR5IG5vdCBmb3VuZHBlcm1pc3Npb24gZGVuaWVkY29ubmVjdGlvbiByZWZ1c2VkY29ubmVjdGlvbiByZXNldGhvc3QgdW5yZWFjaGFibGVuZXR3b3JrIHVucmVhY2hhYmxlY29ubmVjdGlvbiBhYm9ydGVkbm90IGNvbm5lY3RlZGFkZHJlc3MgaW4gdXNlYWRkcmVzcyBub3QgYXZhaWxhYmxlbmV0d29yayBkb3duYnJva2VuIHBpcGVlbnRpdHkgYWxyZWFkeSBleGlzdHNvcGVyYXRpb24gd291bGQgYmxvY2tub3QgYSBkaXJlY3RvcnlpcyBhIGRpcmVjdG9yeWRpcmVjdG9yeSBub3QgZW1wdHlyZWFkLW9ubHkgZmlsZXN5c3RlbSBvciBzdG9yYWdlIG1lZGl1bWZpbGVzeXN0ZW0gbG9vcCBvciBpbmRpcmVjdGlvbiBsaW1pdCAoZS5nLiBzeW1saW5rIGxvb3Apc3RhbGUgbmV0d29yayBmaWxlIGhhbmRsZWludmFsaWQgaW5wdXQgcGFyYW1ldGVyaW52YWxpZCBkYXRhdGltZWQgb3V0d3JpdGUgemVyb25vIHN0b3JhZ2Ugc3BhY2VzZWVrIG9uIHVuc2Vla2FibGUgZmlsZXF1b3RhIGV4Y2VlZGVkZmlsZSB0b28gbGFyZ2VyZXNvdXJjZSBidXN5ZXhlY3V0YWJsZSBmaWxlIGJ1c3lkZWFkbG9ja2Nyb3NzLWRldmljZSBsaW5rIG9yIHJlbmFtZXRvbyBtYW55IGxpbmtzaW52YWxpZCBmaWxlbmFtZWFyZ3VtZW50IGxpc3QgdG9vIGxvbmdvcGVyYXRpb24gaW50ZXJydXB0ZWR1bnN1cHBvcnRlZHVuZXhwZWN0ZWQgZW5kIG9mIGZpbGVvdXQgb2YgbWVtb3J5aW4gcHJvZ3Jlc3N0b28gbWFueSBvcGVuIGZpbGVzaW5wdXQvb3V0cHV0IGVycm9yb3RoZXIgZXJyb3J1bmNhdGVnb3JpemVkIGVycm9yY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZT09IT1tYXRjaGVzMDAwMTAyMDMwNDA1MDYwNzA4MDkxMDExMTIxMzE0MTUxNjE3MTgxOTIwMjEyMjIzMjQyNTI2MjcyODI5MzAzMTMyMzMzNDM1MzYzNzM4Mzk0MDQxNDI0MzQ0NDU0NjQ3NDg0OTUwNTE1MjUzNTQ1NTU2NTc1ODU5NjA2MTYyNjM2NDY1NjY2NzY4Njk3MDcxNzI3Mzc0NzU3Njc3Nzg3OTgwODE4MjgzODQ4NTg2ODc4ODg5OTA5MTkyOTM5NDk1OTY5Nzk4OTkBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMEBAQEBAAAAAAAAAAAAAAAAHgDAAAwBSAADgdgAUkSIAOdFqAoFh+gLSokoDd0K2A99CzgPY2kID4spqBEpNcgRW76oEvQ/WBMNwehTpoj4VuQL2GFVjRBhvtDoYZHRuGGAGEhhwBoQYc5aoGHQG2hh9aMgYrwr+GMI7GBjfyyYY4AvKGPAMzBj7TOAZGm1mGRzNdhmYzaoZkA3+GZkOKBmtDkwZ1x7IGeAPBBotn2QatY+mGuAADiseCmgrQeuKK0rs7itOHrIrVe7mK1APiitR76wrUAAOO1SxMDtno0I7b+/2O2/v+UtgADAACDBCAAkQVgAF0ToAASFyAfDCBgH+8sYCsqMOArb6agLAKoIC0e+yAuAP5gNp7/oDb9ASE3AQphNyQNITirDqE5LxghOvMeIUtANKFTHmHhVPBqYVVPb+FVnbxhVgDPYVdl0aFXANohWADgoVmu4iFb7OThXNDoYV0gAO5e8AF/X08DAAAcBmAAXxGgALQX4AALICABZDGgAQD+YAKgvKECc9GhAwAA7gMAEC4EABBfBAAGAACQCGAADhhgAQsg4AH//iACvRAhAzA0oQOgvCEEc9FhBAEArgSAAP8EdXNlci1wcm92aWRlZCBjb21wYXJpc29uIGZ1bmN0aW9uIGRvZXMgbm90IGNvcnJlY3RseSBpbXBsZW1lbnQgYSB0b3RhbCBvcmRlci4uMHgwMTIzNDU2Nzg5QUJDREVGZmFsc2V0cnVlAAAAAgIHABAREhAQExINDhUMCxUVDw4TJjgZFwwJChAXDg4NFAgbDhAWFQsWDQsTEgsTAEHQ3sAAC+ANBwAAAKsIEABvAAAAMAMAACoAAACrCBAAbwAAADUDAAAeAAAAAAAAAGANEAAAAAAAAAAAAAAAAADwBRAAagAAAMgAAAAWAAAA8AUQAGoAAACvAAAACgAAAJcEEAByAAAAPwAAACoAAACXBBAAcgAAAEYAAAAdAAAAlwQQAHIAAABKAAAAEgAAAMwDEACBAAAATQAAAB8AAADMAxAAgQAAAEcAAAAXAAAANgcQAGsAAAB8AQAAHAAAADYHEABrAAAAuQEAACQAAAA2BxAAawAAAAQBAAAnAAAANgcQAGsAAADKAAAAFAAAADYHEABrAAAAxwAAAA0AAAA2BxAAawAAAIoAAAAgAAAANgcQAGsAAACpAAAAGQAAADYHEABrAAAAhwAAAA0AAAAKBRAAKgAAAEUAAAAaAAAACgUQACoAAABJAAAAFgAAAMQGEABxAAAAKAEAABkAAADEBhAAcQAAACwBAAASAAAAxAYQAHEAAAAxAQAAGQAAAMQGEABxAAAAdwAAABQAAADEBhAAcQAAAFYAAAAZAAAAxAYQAHEAAABYAAAAEgAAAJcEEAByAAAAhgEAABkAAACXBBAAcgAAAIoBAAASAAAAWwYQAGgAAACJAgAAEQAAAFsGEABoAAAAdAIAABEAAADTAhAAcQAAAPEDAAAzAAAA0wIQAHEAAAD8AwAANwAAANUPEAAcAAAAFwAAAAIAAABYMRAA7wcQAG4AAADcAAAAJAAAAMINEADEDRAAxg0QAMgNEABoDxAAaw8QAG8PEAB2DxAAFg4QAHgPEAB9DxAAgQ8QAIsPEACSDxAAlw8QAJ4PEACiDxAA6Q0QAKUPEADKDRAAqQ8QAKwPEACwDxAAtA8QALgPEAC/DxAAwg8QAMgPEADKDxAAzQ8QANEPEADTDxAAEAAAAAAAAAAEAAAABAAAABEAAAASAAAADAAAAAQAAAATAAAAFAAAABUAAABeCBAATAAAAJsBAAARAAAAEgAAAAwAAAAEAAAAFgAAABcAAAAYAAAAEgAAAAwAAAAEAAAAGQAAABoAAAAbAAAAsBMQACoAAAAUAAAAAAAAAAIAAABoMhAAogcQAEwAAAAWAQAALgAAABwAAAAMAAAABAAAAB0AAAAeAAAAHwAAAAAAAAAIAAAABAAAACAAAAAhAAAAIgAAACMAAAAkAAAAEAAAAAQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAAkgUQAF0AAAAYAAAALAAAADUFEABcAAAAFgAAAAkAAABVChAAWgAAAB8AAAANAAAAGwkQAE8AAAAqAQAADQAAABsJEABPAAAAKAEAACAAAAABAAAAAAAAAAAAAAABAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAADgAAADIAAAAMAAAABAAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAADIFRAAHAAAABcAAAAAAAAAAgAAAJAzEAB+AhAAVAAAANsAAAANAAAACAoQAEwAAAAmAAAADQAAAAAAAAAIAAAABAAAADoAAAAcAAAADAAAAAQAAAA7AAAAkgUQAF0AAABBAAAACQAAAF4IEABMAAAA3AAAACQAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAARQMQACYAAAAkAAAAKAAAAP////+0ChAAPQAAAD4AAAA/AAAAAAAAAEAAAAAAAAAAAAAAAAAAAABBAAAAAAAAAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtwkQAFAAAAAcAAAABQAAAEMAAAAMAAAABAAAAEQAAABFAAAARgAAAAAAAAAAAAAAAQAAAEcAAABOBBAASAAAAJECAAAOAAAAawkQAEsAAADmAQAAFAAAAE8AAABQAAAAUQAAAFQ1EABsAxAAXwAAAFYDAAAFAAAAKCsQACorEAAsKxAA6ycQAPsnEAAMKBAAHigQAC4oEAA+KBAAUSgQAGMoEABwKBAAfigQAJMoEACfKBAAqigQAL8oEADUKBAA4ygQAPEoEAAEKRAAKikQAGIpEAB7KRAAkikQAJ4pEACnKRAAsSkQAMEpEADYKRAA5ikQAPQpEAABKhAAFSoQAB0qEAA4KhAARioQAFYqEABsKhAAgSoQAIwqEACiKhAAryoQALoqEADNKhAA3yoQAOoqEAAAXAlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQMNd2l0LWNvbXBvbmVudAcwLjI0NS4xEHdpdC1iaW5kZ2VuLXJ1c3QGMC41OC4wDXdpdC1iaW5kZ2VuLWMGMC41My4x");
		Promise.resolve(module0).catch(() => {});
		let module1 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgAX8AYAN/f38AYAJ/fwBgBH9/f38AAwoJAAECAwIAAAAABAUBcAEJCQcwCgEwAAABMQABATIAAgEzAAMBNAAEATUABQE2AAYBNwAHATgACAgkaW1wb3J0cwEACmkJCQAgAEEAEQAACw0AIAAgASACQQERAQALCwAgACABQQIRAgALDwAgACABIAIgA0EDEQMACwsAIAAgAUEEEQIACwkAIABBBREAAAsJACAAQQYRAAALCQAgAEEHEQAACwkAIABBCBEAAAsALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1NC4w");
		Promise.resolve(module1).catch(() => {});
		let module2 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgAX8AYAN/f38AYAJ/fwBgBH9/f38AAj0KAAEwAAAAATEAAQABMgACAAEzAAMAATQAAgABNQAAAAE2AAAAATcAAAABOAAAAAgkaW1wb3J0cwFwAQkJCQ8BAEEACwkAAQIDBAUGBwgALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1NC4w");
		Promise.resolve(module2).catch(() => {});
		let instanceFlags0 = new WebAssembly.Global({
			value: "i32",
			mutable: !0
		}, 1);
		INSTANCE_FLAGS.set(0, instanceFlags0);
		({exports: exports0} = yield instantiateCore(WebAssembly, yield module1));
		({exports: exports1} = yield instantiateCore(WebAssembly, yield module0, {
			"wasi:cli/environment@0.2.0": { "get-environment": Object.assign(exports0[5], { _jcoMaySuspend: !1 }) },
			"wasi:cli/exit@0.2.0": { exit: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline6, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stderr@0.2.0": { "get-stderr": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline11, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stdin@0.2.0": { "get-stdin": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline9, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/stdout@0.2.0": { "get-stdout": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline10, !1), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-input@0.2.0": { "[resource-drop]terminal-input": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline4), !0), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-output@0.2.0": { "[resource-drop]terminal-output": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline5), !0), { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stderr@0.2.0": { "get-terminal-stderr": Object.assign(exports0[8], { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stdin@0.2.0": { "get-terminal-stdin": Object.assign(exports0[6], { _jcoMaySuspend: !1 }) },
			"wasi:cli/terminal-stdout@0.2.0": { "get-terminal-stdout": Object.assign(exports0[7], { _jcoMaySuspend: !1 }) },
			"wasi:clocks/monotonic-clock@0.2.0": { "subscribe-duration": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline12, !1), { _jcoMaySuspend: !1 }) },
			"wasi:io/error@0.2.0": { "[resource-drop]error": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline0), !0), { _jcoMaySuspend: !1 }) },
			"wasi:io/poll@0.2.0": {
				"[method]pollable.block": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline7, !1), { _jcoMaySuspend: !1 }),
				"[resource-drop]pollable": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline1), !0), { _jcoMaySuspend: !1 }),
				poll: Object.assign(exports0[1], { _jcoMaySuspend: !1 })
			},
			"wasi:io/streams@0.2.0": {
				"[method]output-stream.blocking-flush": Object.assign(exports0[4], { _jcoMaySuspend: !1 }),
				"[method]output-stream.check-write": Object.assign(exports0[2], { _jcoMaySuspend: !1 }),
				"[method]output-stream.subscribe": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline8, !1), { _jcoMaySuspend: !1 }),
				"[method]output-stream.write": Object.assign(exports0[3], { _jcoMaySuspend: !1 }),
				"[resource-drop]input-stream": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline2), !0), { _jcoMaySuspend: !1 }),
				"[resource-drop]output-stream": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline3), !0), { _jcoMaySuspend: !1 })
			},
			"wasi:random/insecure-seed@0.2.12": { "insecure-seed": Object.assign(exports0[0], { _jcoMaySuspend: !1 }) }
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
			7: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline20, !1), { _jcoMaySuspend: !1 }),
			8: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline21, !1), { _jcoMaySuspend: !1 })
		} }));
		postReturn0 = exports1.cabi_post_parse;
		try {
			WebAssembly.promising(exports1.cabi_post_parse);
		} catch {
			exports1.cabi_post_parse;
		}
		exports1Parse = exports1.parse;
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
export { parse };
export const _util = {
	stop: _stopInstance.bind(void 0, _jcoComponentStopContext),
	whenIdle: _whenIdle.bind(void 0, _jcoComponentIdleContext)
};
