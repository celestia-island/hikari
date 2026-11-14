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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABpgEYYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gB39/f39/f38AYAZ/f39/f38AYAR/f39/AX9gBH9/f3wBf2AFf39/f38Bf2AEfn5/fwF+YAJ8fwF/YAh/f39/f39/fwBgA39+fgBgAX8BfmAFf35+fn4AAp0IFiB3YXNpOnJhbmRvbS9pbnNlY3VyZS1zZWVkQDAuMi4xMg1pbnNlY3VyZS1zZWVkAAYTd2FzaTppby9lcnJvckAwLjIuMBRbcmVzb3VyY2UtZHJvcF1lcnJvcgAGEndhc2k6aW8vcG9sbEAwLjIuMBdbcmVzb3VyY2UtZHJvcF1wb2xsYWJsZQAGFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbcmVzb3VyY2UtZHJvcF1pbnB1dC1zdHJlYW0ABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAcW3Jlc291cmNlLWRyb3Bdb3V0cHV0LXN0cmVhbQAGHXdhc2k6Y2xpL3Rlcm1pbmFsLWlucHV0QDAuMi4wHVtyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLWlucHV0AAYed2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4wHltyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLW91dHB1dAAGGndhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wD2dldC1lbnZpcm9ubWVudAAGE3dhc2k6Y2xpL2V4aXRAMC4yLjAEZXhpdAAGEndhc2k6aW8vcG9sbEAwLjIuMBZbbWV0aG9kXXBvbGxhYmxlLmJsb2NrAAYSd2FzaTppby9wb2xsQDAuMi4wBHBvbGwABxV3YXNpOmlvL3N0cmVhbXNAMC4yLjAhW21ldGhvZF1vdXRwdXQtc3RyZWFtLmNoZWNrLXdyaXRlAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQACFXdhc2k6aW8vc3RyZWFtc0AwLjIuMCRbbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gAARV3YXNpOmlvL3N0cmVhbXNAMC4yLjAfW21ldGhvZF1vdXRwdXQt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DQALAkAgCkUNACAJIApBDGxBBBCWgYCAAAsgAyOCgICAAEGBgICAAGqtQiCGIgUgA0EMaq2ENwMwIAMgBSAGhDcDKCAAI4GAgIAAQZ6BwIAAaiADQShqEM2CgIAAAkAgAygCGCIBRQ0AIAMoAhwgAUEBEJaBgIAACyADKAIMIgFFDQIgAygCECABQQEQloGAgAAMAgsgAyABNgIYIAMjgoCAgABBgICAgABqrUIghiADQRhqrYQ3AyggACOBgICAAEHahMCAAGogA0EoahDNgoCAAAwBCyOCgICAACECIAMgATYCGCADIAJBgICAgABqrUIghiIFIANBGGqtIgaENwMoIANBDGojgYCAgAAiBEHahMCAAGoiByADQShqEM2CgIAAIAMgAUEBajYCPCADIAUgA0E8aq2ENwMoIANBGGogByADQShqEM2CgIAAIAMgAkGBgICAAGqtQiCGIgUgBoQ3AzAgAyAFIANBDGqthDcDKCAAIARBp4HAgABqIANBKGoQzYKAgAACQCADKAIYIgFFDQAgAygCHCABQQEQloGAgAALIAMoAgwiAUUNACADKAIQIAFBARCWgYCAAAsgA0HAAGokgICAgAAPCyACIAgQx4KAgAAACyABIAIQx4KAgAAACyOBgICAACIDQeCjwIAAakETIANBuMLCgABqENuCgIAAAAsjgYCAgAAiA0Hgo8CAAGpBEyADQbjCwoAAahDbgoCAAAALOwEBfyABI4GAgIAAIgJB5MrCgABqIAAoAgAtAAAiAEECdGooAgAgAkGwqMCAAGogAGotAAAQ7YKAgAALrQEBAX8jgICAgABBEGsiBSSAgICAAAJAIAIgAWoiASACTw0AQQBBABDHgoCAAAALIAVBBGogACgCACICIAAoAgQgASACQQF0IgIgASACSxsiAkEIQQQgBEEBRhsiASACIAFLGyICIAMgBBDIgICAAAJAIAUoAgRBAUcNACAFKAIIIAUoAgwQx4KAgAAACyAFKAIIIQQgACACNgIAIAAgBDYCBCAFQRBqJICAgIAACxQAIAAoAgQgACgCCCABEIaDgIAAC4QNBQl/A34DfwJ+AX8jgICAgABBIGsiBSSAgICAAAJAAkACQAJAAkACQAJAIAEoAgwiBiACaiICIAZJDQACQCACIAEoAgQiByAHQQFqIghBA3YiCUEHbCAHQQhJ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CwJAIAEtAJUBRQ0AAkACQCABKAKQASIDIAZHDQACQCABKAIwIgggASgCJCIDaiIGIAlNDQAgBiAJa0EBRg0DCwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAhLDQEgASAENgIwDAELIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEXOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEXQQAgDCABKAJ8IApLGxCigICAAAwBC0EBQQMQx4KAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgC0H/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQgCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgCDYCECADQQA2AgggAyAHNgIEIANBgS47AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEH0wcKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBhMLCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEXQQAgDCABKAJ8IApLGxCigICAAAsgACABNgIEIAAgAzYCACACQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEUEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALjgMBAn8gAC0AlAEhBCAAKAKMASEFAkACQAJAIAMNACAEQf8BcUEBRg0BIABB2ABqIAIgASAFQQAQ84CAgAAPCwJAIARB/wFxQQFGDQAgBSAAKAJ8TQ0BIABBADYCYCAAKAJsIQQgAEEANgJsAkAgBEUNACAAKAJoIQMDQAJAAkACQAJAIAMoAgAOAgABAwsgA0EEaigCACIBRQ0CDAELIANBBGooAgAiAUUNAQsgA0EIaigCACABQQEQloGAgAAL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AiggAiABKQKEATcDICABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgAUGEAWohDSABKAJQIAtBA3RqIg4gAzYCBCAOIAM2AgAgASALQQFqNgJUQQAhCwJAIAEoAowBIgNBfEsNACADQQNqIg8gASgCiAFLDQAgDSgCACADaiIOLwAAQa3aAHMgDkECai0AAEEtc3JB//8DcQ0AIAEgDzYCjAFBASELCwJAIAEtAIABQQFHDQAQmIGAgABBA0EBEJWBgIAAIg5FDQIgDkEtOgACIA5BrdoAOwAAIAJBAzYCPCACIA42AjggAkKAgICAMDcCMCABIAMgAkEwaiALEKCAgIAACwJAAkACQCALRQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiANKAIINgJIIAIgDSkCADcDQCABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgASALQQFqNgJUIAEoAlAgC0EDdGoiCyADNgIEIAsgAzYCAAJAIAFBARCigYCAAEUNACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDSACIAEoAowBNgI4IAIgASkChAE3AzAgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgAgAkEQaiABELKAgIAAIAIoAhQhAQJAIAIoAhAiA0EBRw0AIAEgAigCODYCjAEgASACKQMwNwKEAQJAIA0gASgCGEsNACABIA02AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDSACIAEoAowBNgI4IAIgASkChAE3AzAgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgAgAkEIaiABELKAgIAAIAIoAgwhAQJAIAIoAggiA0EBRw0AIAEgAigCODYCjAEgASACKQMwNwKEAQJAIA0gASgCGEsNACABIA02AhgLIAFBNGoQqICA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BAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACABKAIAIAYgBRDLgICAACIDDQsgAC0ANCEFAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAI4GAgIAAIQMgASgCACADQfagwIAAakEJEMuAgIAAIgMNCwJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACOBgICAACEDIAEoAgAgA0HUysKAAGogBUECdGooAgBBAhDLgICAACIDDQsgACgCJCEGIAAoAiAhBwJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACACQQI6ADwjgYCAgAAhAyABKAIAIANB/6DAgABqQQUQy4CAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAAkAgASgCACIBKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWoiBTYCCCABKAIEIANqQdsAOgAAIAZFDQUgBkEcbCEIIAdBGGohBEEBIQMDQAJAAkAgA0EBcUUNACAFIQMMAQsCQCABKAIAIAVHDQAgASAFQQFBAUEBEJqAgIAAIAEoAgghBQsgASAFQQFqIgM2AgggASgCBCAFakEsOgAACwJAIAEoAgAgA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakH7ADoAACAEQXBqKAIAIQUgBEFsaigCACEGIAEjgYCAgABBwqDAgABqQQIQy4CAgAAiAw0MAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAACABIAYgBRDLgICAACIDDQwgBEF8aigCACEFIARBeGooAgAhBgJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQSw6AAAgASOBgICAAEHEoMCAAGpBBRDLgICAACIDDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAIAEgBiAFEMuAgIAAIgMNDCAELQAAIQUCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakEsOgAAIAEjgYCAgABByaDAgABqQQUQy4CAgAAiAw0MAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAAAJAAkACQAJAAkAgBQ4EAAECAwALIAEjgYCAgABBqqDAgABqQQQQy4CAgAAhAwwDCyABI4GAgIAAQa6gwIAAakEHEMuAgIAAIQMMAgsgASOBgICAAEG1oMCAAGpBBxDLgICAACEDDAELIAEjgYCAgABBvKDAgABqQQYQy4CAgAAhAwsgAw0MAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqIgU2AgggASgCBCADakH9ADoAACAEQRxqIQRBACEDIAhBZGoiCA0ACyABKAIAIAVHDQoMCQsgAiABNgIsIAJBAzYCKCACQQQ2AiAgAkEDNgIYIAJBCjYCECACI4GAgIAAIgNBmKPAgABqNgIkIAIgA0HroMCAAGo2AhwgAiADQZWjwIAAajYCFCACIANBgaPAgABqNgIMIAJBOGogAkEMahDKgICAACACKAI4IQMgAi0APCIBQf8BRg0KIAIgAToANCACIAM2AjAgAkEwaiOBgICAAEGJocCAAGpBBSAAQRBqEMyAgIAAIgMNCiACKAIwIgEoAgAhAyAAKAIMIQUgACgCCCEAAkAgAi0ANEEBRg0AAkAgAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACABKAIAIQMLIAMjgYCAgABBiqLAgABqQQYQy4CAgAAiAw0KAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAA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IAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAACQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQfsAOgAAIAIgATYCOCACQQI6ADwgBSAIaiIAQThqKAIAIQcgAEE0aigCACELIAMjgYCAgABBnaLAgABqQQQQy4CAgAAiAw0OAkAgASgCACIDKAIAIAMoAggiBkcNACADIAZBAUEBQQEQmoCAgAAgAygCCCEGCyADIAZBAWo2AgggAygCBCAGakE6OgAAIAEoAgAgCyAHEMuAgIAAIgMNDiACQThqI4GAgIAAQcKgwIAAakECIABByABqEMyAgIAAIgMNDiACQThqI4GAgIAAQaaiwIAAakEEIABBwABqKAIAIABBxABqKAIAEM6AgIAAIgMNDiACQThqI4GAgIAAQaqiwIAAakEIIABB1ABqEMyAgIAAIgMNDgJAIAItADxFDQACQCACKAI4KAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAACyAKIAhBMGoiCEcNAAsLAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakHdADoAAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhACAEQRhqIgQgCUcNAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQd0AOgAACwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AABBACEDDAkLIAIgATYCLCACQQg2AiggAkEENgIgIAJBCDYCGCACQQo2AhAgAiOBgICAACIDQa2jwIAAajYCJCACIANB66DAgABqNgIcIAIgA0Glo8CAAGo2AhQgAiADQYGjwIAAajYCDCACQThqIAJBDGoQyoCAgAAgAigCOCEDIAItADwiAUH/AUYNCCACIAE6ADwgAiADNgI4IAJBOGojgYCAgABBw6HAgABqQQwgACgCCCAAKAIMEM6AgIAAIgMNCCACKAI4IgUoAgAhAyAAKAIYIQQgACgCFCEGAkAgAi0APEEBRg0AAkAgAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBLDoAACAFKAIAIQMLIAMjgYCAgABBz6HAgABqQQgQy4CAgAAiAw0IAkAgBSgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAAkAgBSgCACIAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWoiATYCCCAAKAIEIANqQdsAOgAAIARFDQMgBEEobCELQQAhBEEBIQMDQAJAAkAgA0EBcUUNACABIQMMAQsCQCAAKAIAIAFHDQAgACABQQFBAUEBEJqAgIAAIAAoAgghAQsgACABQQFqIgM2AgggACgCBCABakEsOgAACwJAIAAoAgAgA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakH7ADoAACAGIARqIgFBCGooAgAhCCABQQRqKAIAIQcgACOBgICAAEHXocCAAGpBBBDLgICAACIDDQkCQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakE6OgAAIAAgByAIEMuAgIAAIgMNCSABQRRqKAIAIQggAUEQaigCACEHAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJqAgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBLDoAACAAI4GAgIAAQduhwIAAakECEMuAgIAAIgMNCQJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCagICAACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQTo6AAAgACAHIAgQy4CAgAAiAw0JIAFBIGooAgAhCCABQRxqKAIAIQcCQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakEsOgAAIAAjgYCAgABB3aHAgABqQQQQy4CAgAAiAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJqAgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBOjoAACAAIAcgCBDLgICAACIDDQkgAUEkai0AACEBAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJqAgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBLDoAACAAI4GAgIAAQeGhwIAAakEJEMuAgIAAIgMNCQJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCagICAACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQTo6AAACQAJAAkACQAJAIAEOBAABAgMACyAAI4GAgIAAQeqhwIAAakEFEMuAgIAAIQMMAwsgACOBgICAAEHvocCAAGpBBhDLgICAACEDDAILIAAjgYCAgABB9aHAgABqQQoQy4CAgAAhAwwBCyAAI4GAgIAAQf+hwIAAakELEMuAgIAAIQMLIAMNCQJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCagICAACAAKAIIIQMLIAAgA0EBaiIBNgIIIAAoAgQgA2pB/QA6AABBACEDIAsgBEEoaiIERw0ACyAAKAIAIAFHDQUMBAsgAiABNgIsIAJBBTYCKCACQQQ2AiAgAkEFNgIYIAJBCjYCECACI4GAgIAAIgNBuqPAgABqNgIkIAIgA0HroMCAAGo2AhwgAiADQbWjwIAAajYCFCACIANBgaPAgABqNgIMIAJBOGogAkEMahDKgICAACACKAI4IQECQCACLQA8IgRB/wFHDQAgASEDDAgLIAEoAgAhAyAAKAIMIQYgACgCCCEFAkAgBEEBRg0AAkAgAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACABKAIAIQMLIAMjgYCAgABB66LAgABqQQcQy4CAgAAiAw0HAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAAkAgASgCACIDKAIAIAMoAggiCEcNACADIAhBAUEBQQEQmoCAgAAgAygCCCEICyADIAhBAWoiBDYCCCADKAIEIAhqQdsAOgAAAkACQCAGDQACQCADKAIAIARHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB3QA6AAAMAQsCQCADKAIAIARHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB+wA6AAAgAiABNgI4IAJBAjoAPCOBgICAACEEIAUoAgghCCAFKAIEIQcgAyAEQZ2iwIAAakEEEMuAgIAAIgMNCAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACABKAIAIAcgCBDLgICAACIDDQggAkE4aiOBgICAAEHMosCAAGpBCiAFKAIQIAUoAhQQz4CAgAAiAw0IIAJBOGojgYCAgABB1qLAgABqQQcgBSgCHCAFKAIgEM+AgIAAIgMNCAJAIAItADxFDQACQCACKAI4KAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQf0AOgAACwJAIAZBAUYNACAGQSRsQVxqIQpBACEGA0ACQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAACQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQfsAOgAAIAIgATYCOCACQQI6ADwgBSAGaiIEQSxqKAIAIQcgBEEoaigCACELIAMjgYCAgABBnaLAgABqQQQQy4CAgAAiAw0KAkAgASgCACIDKAIAIAMoAggiCEcNACADIAhBAUEBQQEQmoCAgAAgAygCCCEICyADIAhBAWo2AgggAygCBCAIakE6OgAAIAEoAgAgCyAHEMuAgIAAIgMNCiACQThqI4GAgIAAQcyiwIAAakEKIARBNGooAgAgBEE4aigCABDPgICAACIDDQogAkE4aiOBgICAAEHWosCAAGpBByAEQcAAaigCACAEQcQAaigCABDPgICAACIDDQoCQCACLQA8RQ0AAkAgAigCOCgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH9ADoAAAsgCiAGQSRqIgZHDQALCwJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB3QA6AAALIAAoAhghBCAAKAIUIQYCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAAjgYCAgAAhAyABKAIAIANB8qLAgABqQQ0Qy4CAgAAiAw0HAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWoiBTYCCCADKAIEIABqQdsAOgAAAkACQCAEDQACQCADKAIAIAVHDQAgAyAFQQFBAUEBEJqAgIAAIAMoAgghBQsgAyAFQQFqNgIIIAMoAgQgBWpB3QA6AAAMAQsgBEE8bCELQQAhBUEBIQADQCABKAIAIQMCQCAAQQFxDQACQCADKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAIAEoAgAhAwsCQCADKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH7ADoAACACIAE2AjggBiAFaiIAQQhqKAIAIQggAEEEaigCACEHIAMjgYCAgABB16HAgABqQQQQy4CAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMuAgIAAIgMNCSAAQRRqKAIAIQggAEEQaigCACEHAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAI4GAgIAAIQMgASgCACADQduhwIAAakECEMuAgIAAIgMNCQJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACABKAIAIAcgCBDLgICAACIDDQkgAEEgaigCACEIIABBHGooAgAhBwJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACACQQI6ADwjgYCAgAAhAyABKAIAIANB3aLAgABqQQcQy4CAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMuAgIAAIgMNCSACQThqI4GAgIAAQcSgwIAAakEFIABBMGoQzICAgAAiAw0JIABBLGooAgAhCCAAQShqKAIAIQcgAigCOCIAKAIAIQMCQCACLQA8QQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAAoAgAhAwsgAyOBgICAAEHkosCAAGpBBxDLgICAACIDDQkCQCAAKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgACgCACAHIAgQy4CAgAAiAw0JAkAgACgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH9ADoAAEEAIQAgCyAFQTxqIgVHDQALAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakHdADoAAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhAwwHCyACIAE2AiwgAkEINgIoIAJBBDYCICACQQg2AhggAkEKNgIQIAIjgYCAgAAiA0HHo8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBv6PAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMqAgIAAIAIoAjghAyACLQA8IgFB/wFGDQYgAiABOgA8IAIgAzYCOCACQThqI4GAgIAAQYmhwIAAakEFIABByABqEMyAgIAAIgMNBiACKAI4IgEoAgAhAyAAKAIIIQUgACgCBCEGAkAgAi0APEEBRg0AAkAgAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACABKAIAIQMLIAMjgYCAgABBjqHAgABqQQkQy4CAgAAiAw0GAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNBiAAKAIUIQUgACgCECEGAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAI4GAgIAAIQMgASgCACADQZehwIAAakEKEMuAgIAAIgMNBgJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACABKAIAIAYgBRDLgICAACIDDQYgACgCICEFIAAoAhwhBgJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAACACQQI6ADwjgYCAgAAhAyABKAIAIANBoaHAgABqQQsQy4CAgAAiAw0GAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNBiACQThqI4GAgIAAQayhwIAAakEIIAAoAiggACgCLBDQgICAACIDDQYgAkE4aiAAKAI0IAAoAjgQ0YCAgAAiAw0GIAJBOGogACgCQCAAKAJEENKAgIAAIgMNBiACKAI4KAIAIAItADwQ04CAgAAhAwwGCyABKAIAIAVGDQMMBAsgACgCACABRw0BCyAAIAFBAUEBQQEQmoCAgAAgACgCCCEBCyAAKAIEIAFqQd0AOgAAIAAgAUEBajYCCAJAIAUoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AABBACEDDAILIAEgBUEBQQFBARCagICAACABKAIIIQULIAEoAgQgBWpB3QA6AAAgASAFQQFqNgIIIAJBOGogACgCLCAAKAIwENSAgIAAIgMNACACKAI4KAIAIAItADwQ04CAgAAhAwsgAkHAAGokgICAgAAgAwvyAQEEfwJAIAEoAiAiAigCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH7ADoAACABKAIcIQQgASgCGCEFQf8BIQMCQCACKAIAIAEoAhAgASgCFBDLgICAACIBDQACQCACKAIAIgEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQTo6AABBf0ECIAIoAgAgBSAEEMuAgIAAIgEbIQMgASACIAEbIQELIAAgAzoABCAAIAE2AgAL6QQBBn8CQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWoiBDYCCCAAKAIEIANqQSI6AAACQCACRQ0AA0AgAiEFQQAhAwJAA0AgASADaiIGLQAAIgcjhYCAgABqLQAAIgINASAFIANBAWoiA0cNAAsgBSECDAILAkAgA0UNAAJAIAMgACgCACAEa00NACAAIAQgA0EBQQEQmoCAgAAgACgCCCEECwJAIANFDQAgACgCBCAEaiABIAP8CgAACyAAIAQgA2oiBDYCCAsCQAJAIAJB9QBHDQAgACgCACEBI4aAgIAAIgIgB0EPcWotAAAhCCACIAdBBHZqLQAAIQICQCABIARrQQVLDQAgACAEQQZBAUEBEJqAgIAAIAAoAgghBAsgACgCBCAEaiIBIAg6AAUgASACOgAEIAFB3OrBgQM2AAAgBEEGaiEEDAELAkAgACgCACAEa0EBSw0AIAAgBEECQQFBARCagICAACAAKAIIIQQLIAAoAgQgBGoiASACOgABIAFB3AA6AAAgBEECaiEECyADQX9zIAVqIQIgBkEBaiEBIAAgBDYCCCAFQX9qIANHDQALIAZBAWohASADQX9zIAVqIQILAkAgAkUNAAJAIAIgACgCACAEa00NACAAIAQgAkEBQQEQmoCAgAAgACgCCCEECwJAIAJFDQAgACgCBCAEaiABIAL8CgAACyAAIAQgAmoiBDYCCAsCQCAAKAIAIARHDQAgACAEQQFBAUEBEJqAgIAAIAAoAgghBAsgACAEQQFqNgIIIAAoAgQgBGpBIjoAAEEAC78CAQN/IAAoAgAiBCgCACEFAkAgAC0ABEEBRg0AAkAgBSgCACAFKAIIIgZHDQAgBSAGQQFBAUEBEJqAgIAAIAUoAgghBgsgBSAGQQFqNgIIIAUoAgQgBmpBLDoAACAEKAIAIQULIABBAjoABAJAIAUgASACEMuAgIAAIgUNAAJAIAQoAgAiBSgCACAFKAIIIgBHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpBOjoAACAEKAIAIQUCQAJAIAMoAgBBf0cNAAJAIAUoAgAgBSgCCCIAa0EDSw0AIAUgAEEEQQFBARCagICAACAFKAIIIQALIAUgAEEEajYCCCAFKAIEIABqQe7qseMGNgAADAELIAUgAygCBCADKAIIEMuAgIAAIgUNAQtBACEFCyAFC7sDAQR/I4CAgIAAQSBrIgQkgICAgAAgACgCACIFKAIAIQYCQCAALQAEQQFGDQACQCAGKAIAIAYoAggiB0cNACAGIAdBAUEBQQEQmoCAgAAgBigCCCEHCyAGIAdBAWo2AgggBigCBCAHakEsOgAAIAUoAgAhBgsgAEECOgAEAkAgBiABIAIQy4CAgAAiBg0AAkAgBSgCACIAKAIAIAAoAggiAkcNACAAIAJBAUEBQQEQmoCAgAAgACgCCCECCyAAIAJBAWo2AgggACgCBCACakE6OgAAIAUoAgAhAAJAIAO9QgGGQoCAgICAgIBwVA0AAkAgACgCACAAKAIIIgVrQQNLDQAgACAFQQRBAUEBEJqAgIAAIAAoAgghBQsgACAFQQRqNgIIIAAoAgQgBWpB7uqx4wY2AAAMAQsCQAJAAkAgAyAEQQhqEJmBgIAAIgEgBEEIamsiBSAAKAIAIAAoAggiAmtNDQAgACACIAVBAUEBEJqAgIAAIAAoAgghAgwBCyABIARBCGpGDQELIAVFDQAgACgCBCACaiAEQQhqIAX8CgAACyAAIAIgBWo2AggLIARBIGokgICAgAAgBguTBAEDfyAAKAIAIgUoAgAhBgJAIAAtAARBAUYNAAJAIAYoAgAgBigCCCIHRw0AIAYgB0EBQQFBARCagICAACAGKAIIIQcLIAYgB0EBajYCCCAGKAIEIAdqQSw6AAAgBSgCACEGCyAAQQI6AAQCQCAGIAEgAhDLgICAACIADQACQCAFKAIAIgYoAgAgBigCCCIARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBajYCCCAGKAIEIABqQTo6AAACQCAFKAIAIgYoAgAgBigCCCIARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBaiIFNgIIIAYoAgQgAGpB2wA6AAACQAJAAkAgBA0AIAYoAgAgBUYNAQwCCyAGIANBBGooAgAgA0EIaigCABDLgICAACIADQICQCAEQQFGDQAgA0EQaiEFIARBDGxBdGohAwNAIAVBBGooAgAhAiAFKAIAIQECQCAGKAIAIAYoAggiAEcNACAGIABBAUEBQQEQmoCAgAAgBigCCCEACyAGIABBAWo2AgggBigCBCAAakEsOgAAIAYgASACEMuAgIAAIgANBCAFQQxqIQUgA0F0aiIDDQALCyAGKAIAIAYoAggiBUcNAQsgBiAFQQFBAUEBEJqAgIAAIAYoAgghBQsgBigCBCAFakHdADoAACAGIAVBAWo2AghBACEACyAAC6YLAQN/IAAoAgAiBSgCACEGAkAgAC0ABEEBRg0AAkAgBigCACAGKAIIIgdHDQAgBiAHQQFBAUEBEJqAgIAAIAYoAgghBwsgBiAHQQFqNgIIIAYoAgQgB2pBLDoAACAFKAIAIQYLIABBAjoABAJAIAYgASACEMuAgIAAIgANAAJAIAUoAgAiBigCACAGKAIIIgBHDQAgBiAAQQFBAUEBEJqAgIAAIAYoAgghAAsgBiAAQQFqNgIIIAYoAgQgAGpBOjoAAAJAIAUoAgAiBigCACAGKAIIIgBHDQAgBiAAQQFBAUEBEJqAgIAAIAYoAgghAAsgBiAAQQFqIgU2AgggBigCBCAAakHbADoAAAJAAkACQCAERQ0AIARBKGwhB0EAIQJBASEAA0ACQAJAIABBAXFFDQAgBSEADAELAkAgBigCACAFRw0AIAYgBUEBQQFBARCagICAACAGKAIIIQULIAYgBUEBaiIANgIIIAYoAgQgBWpBLDoAAAsCQCAGKAIAIABHDQAgBiAAQQFBAUEBEJqAgIAAIAYoAgghAAsgBiAAQQFqNgIIIAYoAgQgAGpB+wA6AAAgAyACaiIFQQhqKAIAIQEgBUEEaigCACEEIAYjgYCAgABBsqLAgABqQQoQy4CAgAAiAA0EAkAgBigCACAGKAIIIgBHDQAgBiAAQQFBAUEBEJqAgIAAIAYoAgghAAsgBiAAQQFqNgIIIAYoAgQgAGpBOjoAACAGIAQgARDLgICAACIADQQgBUEUaigCACEBIAVBEGooAgAhBAJAIAYoAgAgBigCCCIARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBajYCCCAGKAIEIABqQSw6AAAgBiOBgICAAEGdosCAAGpBBBDLgICAACIADQQCQCAGKAIAIAYoAggiAEcNACAGIABBAUEBQQEQmoCAgAAgBigCCCEACyAGIABBAWo2AgggBigCBCAAakE6OgAAIAYgBCABEMuAgIAAIgANBCAFQSBqKAIAIQEgBUEcaigCACEEAkAgBigCACAGKAIIIgBHDQAgBiAAQQFBAUEBEJqAgIAAIAYoAgghAAsgBiAAQQFqNgIIIAYoAgQgAGpBLDoAACAGI4GAgIAAQbyiwIAAakEIEMuAgIAAIgANBAJAIAYoAgAgBigCCCIARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBajYCCCAGKAIEIABqQTo6AAAgBiAEIAEQy4CAgAAiAA0EIAVBJGotAAAhAQJAIAYoAgAgBigCCCIARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBajYCCCAGKAIEIABqQSw6AAAgBiOBgICAAEHEosCAAGpBCBDLgICAACIADQQCQCAGKAIAIAYoAggiBUcNACAGIAVBAUEBQQEQmoCAgAAgBigCCCEFCyAGIAVBAWoiADYCCCAGKAIEIAVqQTo6AAACQAJAIAFBAXENAAJAIAYoAgAgAGtBBEsNACAGIABBBUEBQQEQmoCAgAAgBigCCCEACyAGKAIEIABqIgUjgYCAgABBz6PAgABqIgEoAAA2AAAgBSABLQAEOgAEIABBBWohAAwBCwJAIAYoAgAgAGtBA0sNACAGIABBBEEBQQEQmoCAgAAgBigCCCEACyAGKAIEIABqQfTk1asGNgAAIABBBGohAAsgBiAANgIIAkAgBigCACAARw0AIAYgAEEBQQFBARCagICAACAGKAIIIQALIAYgAEEBaiIFNgIIIAYoAgQgAGpB/QA6AABBACEAIAcgAkEoaiICRw0ACyAGKAIAIAVHDQIMAQsgBigCACAFRw0BCyAGIAVBAUEBQQEQmoCAgAAgBigCCCEFCyAGKAIEIAVqQd0AOgAAIAYgBUEBajYCCEEAIQALIAAL1gEBA38gACgCACIFKAIAIQYCQCAALQAEQQFGDQACQCAGKAIAIAYoAggiB0cNACAGIAdBAUEBQQEQmoCAgAAgBigCCCEHCyAGIAdBAWo2AgggBigCBCAHakEsOgAAIAUoAgAhBgsgAEECOgAEAkAgBiABIAIQy4CAgAAiBg0AAkAgBSgCACIGKAIAIAYoAggiAEcNACAGIABBAUEBQQEQmoCAgAAgBigCCCEACyAGIABBAWo2AgggBigCBCAAakE6OgAAIAUoAgAgAyAEEMuAgIAAIQYLIAYLvgUBA38gACgCACIDKAIAIQQCQCAALQAEQQFGDQACQCAEKAIAIAQoAggiBUcNACAEIAVBAUEBQQEQmoCAgAAgBCgCCCEFCyAEIAVBAWo2AgggBCgCBCAFakEsOgAAIAMoAgAhBAsgAEECOgAEAkAgBCOBgICAAEG0ocCAAGpBCRDLgICAACIFDQACQCADKAIAIgQoAgAgBCgCCCIARw0AIAQgAEEBQQFBARCagICAACAEKAIIIQALIAQgAEEBajYCCCAEKAIEIABqQTo6AAACQCADKAIAIgQoAgAgBCgCCCIFRw0AIAQgBUEBQQFBARCagICAACAEKAIIIQULIAQgBUEBaiIANgIIIAQoAgQgBWpB2wA6AAACQAJAAkAgAg0AIAQoAgAgAEYNAQwCCwJAAkAgASgCAEF/Rg0AIAQgASgCBCABKAIIEMuAgIAAIgVFDQEMBAsCQCAEKAIAIABrQQNLDQAgBCAAQQRBAUEBEJqAgIAAIAQoAgghAAsgBCAAQQRqNgIIIAQoAgQgAGpB7uqx4wY2AAALAkAgAkEBRg0AIAJBDGxBdGohAiABQRRqIQADQAJAIAQoAgAgBCgCCCIFRw0AIAQgBUEBQQFBARCagICAACAEKAIIIQULIAQgBUEBaiIDNgIIIAQoAgQgBWpBLDoAAAJAAkAgAEF4aigCAEF/Rw0AAkAgBCgCACADa0EDSw0AIAQgA0EEQQFBARCagICAACAEKAIIIQMLIAQgA0EEajYCCCAEKAIEIANqQe7qseMGNgAADAELIAQgAEF8aigCACAAKAIAEMuAgIAAIgUNBQsgAEEMaiEAIAJBdGoiAg0ACwsgBCgCACAEKAIIIgBHDQELIAQgAEEBQQFBARCagICAACAEKAIIIQALIAQoAgQgAGpB3QA6AAAgBCAAQQFqNgIIQQAhBQsgBQueCgEFfyOAgICAAEEQayIDJICAgIAAIAAoAgAiBCgCACEFAkAgAC0ABEEBRg0AAkAgBSgCACAFKAIIIgZHDQAgBSAGQQFBAUEBEJqAgIAAIAUoAgghBgsgBSAGQQFqNgIIIAUoAgQgBmpBLDoAACAEKAIAIQULIABBAjoABAJAIAUjgYCAgABBvaHAgABqQQYQy4CAgAAiBQ0AAkAgBCgCACIFKAIAIAUoAggiAEcNACAFIABBAUEBQQEQmoCAgAAgBSgCCCEACyAFIABBAWo2AgggBSgCBCAAakE6OgAAAkAgBCgCACIFKAIAIAUoAggiBkcNACAFIAZBAUEBQQEQmoCAgAAgBSgCCCEGCyAFIAZBAWoiADYCCCAFKAIEIAZqQdsAOgAAAkACQCACDQACQCAFKAIAIABHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpB3QA6AAAMAQsCQCAFKAIAIABHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpB+wA6AAAgAyAENgIIIANBAjoADCOBgICAACEAIAEoAhghBiABKAIUIQcgBSAAQcSgwIAAakEFEMuAgIAAIgUNAQJAIAQoAgAiBSgCACAFKAIIIgBHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpBOjoAACAEKAIAIAcgBhDLgICAACIFDQEgA0EIaiOBgICAAEH/osCAAGpBASABKwMAEM2AgIAAIgUNASADQQhqI4GAgIAAQYCjwIAAakEBIAErAwgQzYCAgAAiBQ0BAkAgAy0ADEUNAAJAIAMoAggoAgAiBSgCACAFKAIIIgBHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpB/QA6AAALAkAgAkEBRg0AIAJBBXRBYGohByABQThqIQADQAJAIAQoAgAiBSgCACAFKAIIIgFHDQAgBSABQQFBAUEBEJqAgIAAIAUoAgghAQsgBSABQQFqNgIIIAUoAgQgAWpBLDoAAAJAIAQoAgAiBSgCACAFKAIIIgFHDQAgBSABQQFBAUEBEJqAgIAAIAUoAgghAQsgBSABQQFqNgIIIAUoAgQgAWpB+wA6AAAgAyAENgIIIANBAjoADCAAQXxqKAIAIQYjgYCAgAAhASAAKAIAIQIgBSABQcSgwIAAakEFEMuAgIAAIgUNAwJAIAQoAgAiBSgCACAFKAIIIgFHDQAgBSABQQFBAUEBEJqAgIAAIAUoAgghAQsgBSABQQFqNgIIIAUoAgQgAWpBOjoAACAEKAIAIAYgAhDLgICAACIFDQMgA0EIaiOBgICAAEH/osCAAGpBASAAQWhqKwMAEM2AgIAAIgUNAyADQQhqI4GAgIAAQYCjwIAAakEBIABBcGorAwAQzYCAgAAiBQ0DAkAgAy0ADEUNAAJAIAMoAggoAgAiBSgCACAFKAIIIgFHDQAgBSABQQFBAUEBEJqAgIAAIAUoAgghAQsgBSABQQFqNgIIIAUoAgQgAWpB/QA6AAALIABBIGohACAHQWBqIgcNAAsLAkAgBCgCACIFKAIAIAUoAggiAEcNACAFIABBAUEBQQEQmoCAgAAgBSgCCCEACyAFIABBAWo2AgggBSgCBCAAakHdADoAAAtBACEFCyADQRBqJICAgIAAIAULUQACQCABQf8BcUUNAAJAIAAoAgAgACgCCCIBRw0AIAAgAUEBQQFBARCagICAACAAKAIIIQELIAAgAUEBajYCCCAAKAIEIAFqQf0AOgAAC0EAC+4KAQd/I4CAgIAAQRBrIgMkgICAgAAgACgCACIEKAIAIQUCQCAALQAEQQFGDQACQCAFKAIAIAUoAggiBkcNACAFIAZBAUEBQQEQmoCAgAAgBSgCCCEGCyAFIAZBAWo2AgggBSgCBCAGakEsOgAAIAQoAgAhBQsgAEECOgAEAkAgBSOBgICAAEGEocCAAGpBBRDLgICAACIFDQACQCAEKAIAIgUoAgAgBSgCCCIARw0AIAUgAEEBQQFBARCagICAACAFKAIIIQALIAUgAEEBajYCCCAFKAIEIABqQTo6AAACQCAEKAIAIgUoAgAgBSgCCCIARw0AIAUgAEEBQQFBARCagICAACAFKAIIIQALIAUgAEEBaiIGNgIIIAUoAgQgAGpB2wA6AAACQAJAIAINAAJAIAUoAgAgBkcNACAFIAZBAUEBQQEQmoCAgAAgBSgCCCEGCyAFIAZBAWo2AgggBSgCBCAGakHdADoAAAwBCyACQShsIQdBACEGQQEhAANAIAQoAgAhBQJAIABBAXENAAJAIAUoAgAgBSgCCCIARw0AIAUgAEEBQQFBARCagICAACAFKAIIIQALIAUgAEEBajYCCCAFKAIEIABqQSw6AAAgBCgCACEFCwJAIAUoAgAgBSgCCCIARw0AIAUgAEEBQQFBARCagICAACAFKAIIIQALIAUgAEEBajYCCCAFKAIEIABqQfsAOgAAIAMgBDYCCCABIAZqIgBBCGooAgAhCCAAQQRqKAIAIQkgBSOBgICAAEHXoMCAAGpBBhDLgICAACIFDQICQCAEKAIAIgUoAgAgBSgCCCICRw0AIAUgAkEBQQFBARCagICAACAFKAIIIQILIAUgAkEBajYCCCAFKAIEIAJqQTo6AAAgBCgCACAJIAgQy4CAgAAiBQ0CIABBFGooAgAhCCAAQRBqKAIAIQkCQCAEKAIAIgUoAgAgBSgCCCICRw0AIAUgAkEBQQFBARCagICAACAFKAIIIQILIAUgAkEBajYCCCAFKAIEIAJqQSw6AAAgA0ECOgAMI4GAgIAAIQUgBCgCACAFQd2gwIAAakEGEMuAgIAAIgUNAgJAIAQoAgAiBSgCACAFKAIIIgJHDQAgBSACQQFBAUEBEJqAgIAAIAUoAgghAgsgBSACQQFqNgIIIAUoAgQgAmpBOjoAACAEKAIAIAkgCBDLgICAACIFDQIgA0EIaiOBgICAAEHEoMCAAGpBBSAAQRhqEMyAgIAAIgUNAiAAQSRqLQAAIQggAygCCCIAKAIAIQUCQCADLQAMQQFGDQACQCAFKAIAIAUoAggiAkcNACAFIAJBAUEBQQEQmoCAgAAgBSgCCCECCyAFIAJBAWo2AgggBSgCBCACakEsOgAAIAAoAgAhBQsgBSOBgICAAEHjoMCAAGpBCBDLgICAACIFDQICQCAAKAIAIgUoAgAgBSgCCCICRw0AIAUgAkEBQQFBARCagICAACAFKAIIIQILIAUgAkEBajYCCCAFKAIEIAJqQTo6AAAgACgCACEFAkACQCAIQQFxRQ0AIAUjgYCAgABB06DAgABqQQQQy4CAgAAhBQwBCyAFI4GAgIAAQc6gwIAAakEFEMuAgIAAIQULIAUNAgJAIAAoAgAiBSgCACAFKAIIIgBHDQAgBSAAQQFBAUEBEJqAgIAAIAUoAgghAAsgBSAAQQFqNgIIIAUoAgQgAGpB/QA6AABBACEAIAcgBkEoaiIGRw0ACwJAIAQoAgAiBCgCACAEKAIIIgVHDQAgBCAFQQFBAUEBEJqAgIAAIAQoAgghBQsgBCAFQQFqNgIIIAQoAgQgBWpB3QA6AAALQQAhBQsgA0EQaiSAgICAACAFC+sEAgR/Bn4gACAAKAI4IAJqNgI4AkACQCAAKAI8IgMNAEEAIQQMAQtBBCEFAkACQEEIIANrIgQgAiAEIAJJGyIGQQRPDQBCACEHQQAhBQwBCyABNQAAIQcLAkAgBUEBciAGTw0AIAEgBWozAAAgBUEDdK2GIAeEIQcgBUECciEFCwJAIAUgBk8NACABIAVqMQAAIAVBA3SthiAHhCEHCyAAIAApAzAgByADQQN0rYaEIgc3AzACQCACIARJDQAgACAAKQMIIAApAxggB4UiCHwiCSAAKQMQIgpCDYkgCiAAKQMAfCIKhSILfCIMIAtCEYmFNwMQIAAgDEIgiTcDCCAAIAkgCEIQiYUiCEIViSAIIApCIIl8IgiFNwMYIAAgCCAHhTcDAAwBCyAAIAMgAmo2AjwPCyACIARrIgJBB3EhBQJAIAQgAkF4cSICTw0AIAApAwghCCAAKQMQIQcgACkDGCEJIAApAwAhCgNAIAggCSABIARqKQAAIguFIgl8IgggB0INiSAHIAp8IgqFIgd8IgwgB0IRiYUhByAIIAlCEImFIghCFYkgCCAKQiCJfCIKhSEJIAxCIIkhCCAKIAuFIQogBEEIaiIEIAJJDQALIAAgBzcDECAAIAk3AxggACAINwMIIAAgCjcDAAtBBCECAkACQCAFQQRPDQBCACEHQQAhAgwBCyABIARqNQAAIQcLAkAgAkEBciAFTw0AIAEgBGogAmozAAAgAkEDdK2GIAeEIQcgAkECciECCwJAIAIgBU8NACABIAIgBGpqMQAAIAJBA3SthiAHhCEHCyAAIAc3AzAgACAFNgI8C9EDAgF/BH4jgICAgABB0ABrIgQkgICAgAAgBEIANwM4IARCADcDQCAEIAE3AzAgBCABQvPK0cunjNmy9ACFNwMgIAQgAULt3pHzlszct+QAhTcDGCAEIAA3AyggBCAAQuHklfPW7Nm87ACFNwMQIAQgAEL1ys2D16zbt/MAhTcDCCAEQQhqIAIgAxDVgICAACAEQf8BOgBPIARBCGogBEHPAGpBARDVgICAACAEKQMIIQAgBCkDGCEBIAQ1AkAhBSAEKQM4IQYgBCkDICEHIAQpAxAhCCAEQdAAaiSAgICAACAHIAYgBUI4hoQiBYUiBkIQiSAGIAh8IgaFIgdCFYkgByABIAB8IgBCIIl8IgeFIghCEIkgCCAGIAFCDYkgAIUiAXwiAEIgiUL/AYV8IgaFIghCFYkgCCAHIAWFIAAgAUIRiYUiAXwiAEIgiXwiBYUiB0IQiSAHIAAgAUINiYUiASAGfCIAQiCJfCIGhSIHQhWJIAcgACABQhGJhSIBIAV8IgBCIIl8IgWFIgdCEIkgByABQg2JIACFIgEgBnwiAEIgiXwiBoVCFYkgAUIRiSAAhSIBQg2JIAEgBXyFIgFCEYmFIAEgBnwiAUIgiYUgAYULvAkBCH8jgICAgABB4ABrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AIAEoAhghBCACIAEoAowBNgIoIAIgASkChAE3AyAgASgCPCEFAkAgASgCVCIGIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhAyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghByACIAFBhAFqIgUoAgg2AjggAiAFKQIANwMwIAEoAjwhBgJAIAEoAlQiCCABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASAIQQFqNgJUIAEoAlAgCEEDdGoiCCAGNgIEIAggBjYCAAJAIAFBARCigYCAAEUNACABKAIYIQggAiAFKAIINgJIIAIgBSkCADcDQCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBGGogARCvgICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQRBqIAEQr4CAgAAgAigCFCEBAkAgAigCECIFQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAVBAXENAANAAkACQCABQQEQooGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQQhqIAEQr4CAgAAgAigCDCEBAkAgAigCCCIFQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAFQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJINgKMASABIAIpA0A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAIgARDYgICAACACKAIEIQEgAigCACEDCwJAIANBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCAHIAEoAhhLDQAgASAHNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBRw0AIAEgAigCKDYCjAEgASACKQMgNwKEAQJAIAQgASgCGEsNACABIAQ2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgACADNgIAIAAgATYCBCACQeAAaiSAgICAAAuUFQEOfyOAgICAAEHwAGsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASEDAkACQAJAAkACQAJAAkAgAUEBEKKBgIAARQ0AIAEoAhghCyACIAEoAowBNgJIIAIgASkChAE3A0AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQooGAgABFDQAgASgCGCEOIAIgAUGEAWoiDCgCCDYCWCACIAwpAgA3A1AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQAJAIAFBARCigYCAAEUNACACQThqIAEQsoCAgAAgAigCPCEBAkAgAigCOEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEwaiABELKAgIAAIAIoAjQhAQJAIAIoAjAiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCAMQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEoaiABELKAgIAAIAIoAiwhAQJAIAIoAigiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgDEEBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAACACQSBqIAEQhoGAgAAgAigCJCEBIAIoAiBBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAIAFBARCigYCAAEUNACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEQaiABELKAgIAAIAIoAhQhAQJAIAIoAhAiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCAMQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEMDAELIAEoAhghDyACIAEoAowBNgJoIAIgASkChAE3A2AgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgAgAkEIaiABELKAgIAAIAIoAgwhAQJAIAIoAggiDEEBRw0AIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgDEEBRw0ACwsgAS0ADEECRg0ECyABLQAMQQJGDQMLIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIA4gASgCGEsNACAB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IAEtAAxBAkYNAQsgASACKAJoNgKMASABIAIpA2A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBIGogARDagICAACACKAIkIQEgAigCIEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQggAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkACQCABQQEQooGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgBUEBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAVBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAmg2AowBIAEgAikDYDcChAECQCAIIAEoAhhLDQAgASAINgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAiABENuAgIAAIAIoAgQhASACKAIAIQMLAkAgA0EBRw0AIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIAcgASgCGEsNACABIAc2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFHDQAgASACKAJINgKMASABIAIpA0A3AoQBAkAgBCABKAIYSw0AIAEgBDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAAIAM2AgAgACABNgIEIAJBgAFqJICAgIAAC4oJAQt/I4CAgIAAQSBrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKIAJBGGogARCMgYCAACACKAIcIQECQAJAAkAgAigCGEEBRw0AIAJBEGogARCkgICAACACKAIUIQEgAigCEEEBRw0AIAJBCGogARCxgICAACACKAIMIQEgAigCCEEBcQ0BC0EAIQsMAQsgAiABEJ6AgIAAIAIoAgQhASACKAIAIQsLQQEhAyABLQCUASEMAkACQAJAAkACQAJAIAtBAUcNACAMQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiDCABKAIkIgNqIgYgCE0NACAGIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgDEsNAiABIAQ2AjAMAgsgDEH/AXFBAUcNAyABLQCVAUUNBAJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiDGoiBiAITQ0AIAYgCGtBAUYNBwsCQCAFIAxLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQUgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakETOgAAIAEgA0EBajYCMCABLQCUASEMDAMLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakETOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQRNBACAKIAEoAnwgCUsbEKKAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDEH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQwCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgDDYCECADQQA2AgggAyAHNgIEIANBgSY7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEH0wcKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBhMLCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakETQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQSBqJICAgIAAC5gQAQ5/I4CAgIAAQeAAayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQCABQQEQooGAgABFDQAgASgCGCEMIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEoaiABEIqBgIAAIAIoAiwhAQJAIAIoAihBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBIGogARCygICAACACKAIkIQECQCACKAIgQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJINgKMASABIAIpA0A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAQQEhCyABQQEQooGAgABFDQAgAkEIaiABEI2BgIAAIAIoAgwhAQJAIAIoAggiC0EBRw0AIAEtAAxBAkcNAQtBACELCwJAIAtBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCAMIAEoAhhLDQAgASAMNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALQQEhAyABLQCUASENAkACQAJAAkACQAJAIAtBAUcNACANQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAF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KAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEQEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEEQSgQyICAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEMeCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAt/AQN/I4CAgIAAQRBrIgEkgICAgAAgAUEEaiAAKAIAIgIgACgCBCACQQF0IgJBBCACQQRLGyICQQRBGBDIgICAAAJAIAEoAgRBAUcNACABKAIIIAEoAgwQx4KAgAAACyABKAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBCEEgEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEEQSQQyICAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEMeCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAt/AQN/I4CAgIAAQRBrIgEkgICAgAAgAUEEaiAAKAIAIgIgACgCBCACQQF0IgJBBCACQQRLGyICQQRBPBDIgICAAAJAIAEoAgRBAUcNACABKAIIIAEoAgwQx4KAgAAACyABKAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBCEEYEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAggh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AiICKAIMIgFBAUgNACACKAIQIAFBARCWgYCAAAsCQCACKAIAIgFFDQAgAigCBCABQQEQloGAgAALAkAgAigCGCIBQQFIDQAgAigCHCABQQEQloGAgAALAkAgAigCJEF/Rg0AIAJBJGoQvoCAgAALIAJB0ABBBBCWgYCAACADIAMpAtAEIgQ3A6AEIAMgAygC2AQiAjYCqAQgAyACNgL4AyADIAQ3A/ADIAAgAjYCDCAAIAQ3AgQgAEF/NgIADAELIAMgAykCLDcDWCADIAMoAjQ2AmAgAyADKQIgNwNoIAMgAygCKDYCcCADKAIcIQJBACEFIANBADYCfCADQoCAgIDAADcCdCADQQA2AogBIANCgICAgMAANwKAAQJAI4SAgIAALQAQQQFGDQBBABC2gICAAAsjhICAgAAiASABKQMAIgRCAXw3AwAgAyABKQMINwPQAiADIAQ3A8gCIAMjgYCAgABBmMLCgABqIgEpAwA3A7gCIAMgASkDCDcDwAIgAyADKQNYIgQ3ApwBIAMgAjYCjAEgAyADKQNoNwKQASADIAMoAnA2ApgBIAMgAygCYDYCpAECQCAEpyIGIAMoAqABTw0AIANBGGpBDGohByADQdAEakEMaiEIIANB7ARqQQxqIQkgA0G8BGpBDGohCiADQaAEakEMaiELIANBjARqQQxqIQwgA0HwA2pBDGohDSADQcQDakEMaiEOIANBqANqQQxqIQ8gA0GUA2pBDGohECADQfgCakEMaiERIANBnAJqQQxqIRIgA0GIAmpBDGohEyADQewBakEMaiEUIANB2AFqQQxqIRUgA0G8AWpBDGohFiADQagBakEMaiEXQQAhBQNAIAIgAigCAEEBaiIBNgIAAkACQAJAIAFFDQAgAygCmAEiASABKAIAQQFqIhg2AgAgGEUNAAJAIAYgAigCECIZTw0AAkAgAigCDCIaIAZBFGxqIhstAAANACADKAKUASEYIAMoApABIRwgAyADKAKkAUF/ajYCpAEgAyAbKAIEIh1BAWo2ApwBIAMgBjYCuAEgAyABNgK0ASADIBg2ArABIAMgHDYCrAEgAyACNgKoAQJAIB0gGU8NAAJAIBogHUEUbGoiGy0AAEUNAAJAIBstAAFBAUYNACACIAIoAgBBf2oiBjYCAAJAIAYNACADQagBahDxgICAAAsgASABKAIA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ahDkgoCAAAALI4GAgIAAIgNBuZ7AgABqQSggA0HIxcKAAGoQ1oKAgAAACyOBgICAACIDQbmewIAAakEoIANB+MLCgABqENaCgIAAAAsgLyAsI4GAgIAAQbjFwoAAahDkgoCAAAALI4GAgIAAIgNBuZ7AgABqQSggA0HIxcKAAGoQ1oKAgAAACyArIBhGDQAgHCAraiwAAEG/f0wNAQsgA0EQaiAcICRqICsgJGsQl4CAgABBACErIAMoAhQiJEEASA0CICQNAUIBITwMAwsgHCAYICQgKyOBgICAAEGIxcKAAGoQ8IKAgAAACyADKAIQIS8QmIGAgABBASErICRBARCVgYCAACIsRQ0AAkAgJEUNACAsIC8gJPwKAAALICytITwMAQsgKyAkEMeCgIAAAAsgAiACKAIAQX9qIis2AgACQCArDQAgA0HsBGoQ8YCAgAALIAEgASgCAEF/aiIrNgIAICsNACAJEPKAgIAACyACIAIoAgBBf2oiKzYCAAJAICsNACADQRhqEPGAgIAACyABIAEoAgBBf2oiKzYCAAJAICsNACAHEPKAgIAACyACIAIoAgBBf2oiKzYCACAkrUIghiEEAkAgKw0AIANB0ARqEPGAgIAACyAEIDyEIQQgASABKAIAQX9qIis2AgACQCArDQAgCBDygICAAAtBASEsAkAgBEKAgICAEFQNACAkIS8MCgtBfyEvICRFDQhBASEsIDynICRBARCWgYCAAAwICyAvIDIjgYCAgABB6MLCgABqEOSCgIAAAAsgKyAYRg0AIBwgK2osAABBv39MDQELIANBCGogHCAkaiArICRrEJeAgIAAQQAhKyADKAIMIiRBAEgNAiAkDQFCASE8DAMLIBwgGCAkICsjgYCAgABBiMXCgABqEPCCgIAAAAsgAygCCCEvEJiBgIAAQQEhKyAkQQEQlYGAgAAiLEUNAAJAICRFDQAgLCAvICT8CgAACyAsrSE8DAELICsgJBDHgoCAAAALIAIgAigCAEF/aiIrNgIAAkAgKw0AIANB7ARqEPGAgIAACyABIAEoAgBBf2oiKzYCACArDQAgCRDygICAAAsgAiACKAIAQX9qIis2AgACQCArDQAgA0EYahDxgICAAAsgASABKAIAQX9qIis2AgACQCArDQAgBxDygICAAAsgAiACKAIAQX9qIis2AgAgJK1C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IAEgBmohCSACIAZrIQUCQAJAA0ACQCAFIgYNAEEBIQcMAgsCQCAJIAZqIghBf2oiBSwAACIHQX9KDQACQAJAIAhBfmoiBS0AACICwCIBQUBIDQAgAkEfcSEIDAELAkACQCAIQX1qIgUtAAAiAsAiBEFASA0AIAJBD3EhCAwBCyAIQXxqIgUtAABBB3FBBnQgBEE/cXIhCAsgCEEGdCABQT9xciEICyAIQQZ0IAdBP3FyIQcLIAUgA2shBSAHQSJGDQALQQAhBSAGQQBIDQEQmIGAgABBASEFIAZBARCVgYCAACIHRQ0BIAZFDQAgByAJIAb8CgAACyAAIAY2AgggACAHNgIEIAAgBjYCAA8LIAUgBhDHgoCAAAAL2isCEn8DfiOAgICAAEHQA2siAySAgICAACADQQA2AqgBIANCgICAgMAANwKgASADQQA2ArQBIANCgICAgMAANwKsASADQX82ArgBIANBADsBgAIgAyACNgL8ASADQQA2AvgBIANBAToA9AEgA0EKNgLwASADIAI2AuwBIANBADYC6AEgAyACNgLkASADIAE2AuABIANBCjYC3AEgA0GYAWogA0HcAWoQ9ICAgAACQAJAAkAgAygCmAEiAUUNACADQZADakEYaiEEIANBkANqQQxqIQUgA0GEAmpBJWohBiADQbgBakEYaiEHIANBuAFqQQxqIQggA0GsAmpBJWohCSADKAKcASECQQAhCkEAIQsDQAJAAkAgAg0AQQAhAgwBCyABIAJBf2oiDGotAABBCkcNACACQX5qIQICQAJAIAwNAEEAIQ0MAQsgAUEAIAEgAmotAABBDUYbIQ0LIAIgDCANGyECIA0gASANGyEBCyADQZABaiABIAIQl4CAgAAgAygCkAEhAgJAAkACQAJAAkACQAJAAkACQAJAIAMoApQBIgEODQgBAQEBAQEBAQEBAQABCyACKQAAQuPYhZu3jtG04QCFIAJBCGo1AABC5+SF6waFhFANByAKIAMoArgBIgxBf0dxDQYgAigAAEHj2IWbB3MgAkEEai8AAEHzwABzckUNAQwICyAKIAMoArgBIgxBf0dxDQEgAUEGSQ0HIAIoAABB49iFmwdzIAJBBGovAABB88AAc3INByABQQhJDQILIANBiAFqQfsAIAIgARD5goCAACADKAKIAUEBcUUNBgwCCyABQQFHDQMgAi0AAEH9AEcNAyALQX9qIgsNAyADQZADaiADQbgBahDOgoCAACAFIAMoAsgBIAMoAswBEP6AgIAAIAQgAygC1AEgAygC2AEQ/oCAgAACQCADKAKoASIBIAMoAqABRw0AIANBoAFqEOqAgIAACyADKAKkASABQSRsaiICIAMoArADNgIgIAIgAykCqAM3AhggAiADKQKgAzcCECACIAMpApgDNwIIIAIgAykCkAM3AgAgAyABQQFqNgKoASADKAK4ASICQX9GDQICQCACRQ0AIAMoArwBIAJBARCWgYCAAAsgCBC7gICAACAHELuAgIAADAILIAItAABB+wBGDQAgAi0AAUH7AEYNACACLQACQfsARg0AIAItAANB+wBGDQAgAi0ABEH7AEYNACACLQAFQfsARg0AIAFBBkYNBCACLQAGQfsARw0ECwJAAkAgAigAAEHj2IWbB3MgAkEEai8AAEHzwABzckUNACAAQX82AgAMAQsgA0GAAWogAkEGaiABQXpqEJeAgIAAIAMoAoABIQ4gAygChAEhDSADQQE7AbQDIAMgDTYCsAMgA0EANgKsAyADQQE6AKgDIANB+wA2AqQDIAMgDTYCoAMgA0EANgKcAyADIA02ApgDIAMgDjYClAMgA0H7ADYCkAMgA0H4AGogA0GQA2oQ9YCAgAACQAJAAkACQAJAIAMoAngiDUUNACADQfAAaiANIAMoAnwQl4CAgABBACEOAkAgAygCdCINQQBIDQAgDUUNAyADKAJwIQ8QmIGAgABBASEOIA1BARCVgYCAACIQDQIgDSEQCyAOIBAQx4KAgAAACyAAQX82AgAMBAsCQCANRQ0AIBAgDyAN/AoAAAsgA0IENwLwAiADQgA3AugCIANCgICAgMAANwLgAiADIA02AtwCIAMgEDYC2AIgAyANNgLUAiADQQE7AbQDIAMgATYCsAMgA0EANgKsAyADQQE6AKgDIANB+wA2AqQDIAMgATYCoAMgA0EANgKcAyADIAE2ApgDIAMgAjYClAMgA0H7ADYCkAMgA0HoAGogA0GQA2oQ9YCAgAAgAygCaEUNAiADQeAAaiADQZADahD1gICAACADKAJgIgFFDQICQAJAIAMoAmQiAkEHSw0AIAJFDQQgAS0AAEH9AEYNASACQQFGDQQgAS0AAUH9AEYNASACQQJGDQQgAS0AAkH9AEYNASACQQNGDQQgAS0AA0H9AEYNASACQQRGDQQgAS0ABEH9AEYNASACQQVGDQQgAS0ABUH9AEYNASACQQZGDQQgAS0ABkH9AEYNAQwECyADQdgAakH9ACABIAIQ+YKAgAAgAygCWEEBcUUNAwsgA0EBOwG0AyADIAI2ArADIANBADYCrAMgA0EBOgCoAyADQf0ANgKkAyADIAI2AqADIANBADYCnAMgAyACNgKYAyADIAE2ApQDIANB/QA2ApADIANB0ABqIANBkANqEPWAgIAAIAMoAlQhASADKAJQIQIgA0EBOwG0AyADIAFBACACGyIBNgKwAyADQQA2AqwDIANBAToAqAMgA0E7NgKkAyADIAE2AqADIANBADYCnAMgAyABNgKYAyADIAJBASACGzYClAMgA0E7NgKQAyADQcgAaiADQZADahD1gICAACADKAJIIgJFDQEgAygCTCEBA0AgA0HAAGogAiABEJeAgIAAIANBrAJqIAMoAkAgAygCRBD7gICAAAJAIAMoAqwCQX9GDQACQCADLQDQAkEBcQ0AAkAgAygC6AIiASADKALgAkcNACADQdQCakEMahDngICAAAsgAygC5AIgAUEobGoiAiADKQKsAjcCACACIAMpArQCNwIIIAIgAykCvAI3AhAgAiADKQLEAjcCGCACIAMoAswCNgIgIAJBADoAJCACIAkvAAA7ACUgAiAJLQACOgAnIAMgAUEBajYC6AIMAQsCQCADKAL0AiIBIAMoAuwCRw0AIANB1AJqQRhqEOeAgIAACyADKALwAiABQShsaiICIAMpAqwCNwIAIAIgAykCtAI3AgggAiADKQK8AjcCECACIAMpAsQCNwIYIAIgAygCzAI2AiAgAkEBOgAkIAIgCS8AADsAJSACIAktAAI6ACcgAyABQQFqNgL0AgsgA0E4aiADQZADahD1gICAACADKAI8IQEgAygCOCICRQ0CDAALC0EBIRAMBQsCQCADKAKoASIBIAMoAqABRw0AIANBoAFqEOqAgIAACyADKAKkASABQSRsaiICIAMpAtQCNwIAIAIgAykC3AI3AgggAiADKQLkAjcCECACIAMpAuwCNwIYIAIgAygC9AI2AiAgAyABQQFqNgKoAQwECwJAIAxBf0YNAAJAIAxFDQAgAygCvAEgDEEBEJaBgIAACyAIELuA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mAMgAyADKQO4ATcDkAMgAygCpAMNASADKAKwAw0BAkAgAygCkAMiAkUNACADKAKUAyACQQEQloGAgAALIANBnANqELuAgIAAIANBqANqELuAgIAAIAMoAqgBIQIMAgsgAygCqAENAiAAQX82AgAMBAsCQCADKAKoASIBIAMoAqABRw0AIANBoAFqEOqAgIAACyADKALYASEMIAMpA9ABIRUgAykDyAEhFiADKQPAASEXIAMoAqQBIAFBJGxqIgIgAykDuAE3AgAgAiAXNwIIIAIgFjcCECACIBU3AhggAiAMNgIgIAMgAUEBaiICNgKoAQsgAkUNAQsgACADKQKgATcCACADIAMoAqgBNgKYAyADIAMpAqwBNwKcAyAAIAMpA5gDNwIIIAMgAygCtAE2AqQDIAAgAykDoAM3AhAMAgsgAEF/NgIACyADQawBahC9gICAACADKAKkASENAkAgAygCqAEiAUUNACANIQIDQAJAIAIoAgAiDEUNACACQQRqKAIAIAxBARCWgYCAAAsgAkEMahC7gICAACACQRhqELuAgIAAIAJBJGohAiABQX9qIgENAAsLIAMoAqABIgJFDQAgDSACQSRsQQQQloGAgAALIANB0ANqJICAgIAAC5oCAQh/I4CAgIAAQTBrIgMkgICAgAACQAJAAkAgAg0AQQQhBAwBCxCYgYCAACACQShsIgVBBBCVgYCAACIERQ0BIAJBKGwhBiADQQhqQRhqIQcgA0EIakEMaiEIQQAhCSACIQoDQCAGIAlGDQEgA0EIaiABEM6CgIAAIAggAUEMahDOgoCAACAHIAFBGGoQzoKAgAAgBCAJaiIFIAMpAgg3AgAgBSADKQIQNwIIIAUgAykCGDcCECAFIAMpAiA3AhggAyABLQAkOgAsIAUgAykCKDcCICAJQShqIQkgAUEoaiEBIApBf2oiCg0ACwsgACACNgIIIAAgBDYCBCAAIAI2AgAgA0EwaiSAgICAAA8LQQQgBRDHgoCAAAAL/AkCD38BfgJAAkACQAJAAkACQAJAIAEoAgANAEEAIQIgAS0ADg0GIAEtAAwhAyABKAI0IQQgASgCMCEFAkAgASgCBCICRQ0AAkAgAiAESQ0AIAIgBEYNAQwECyAFIAJqLAAAQUBIDQMLAkACQCACIARGDQACQAJAIAUgAmoiBiwAACIHQX9KDQAgBi0AAUE/cSEIIAdBH3EhCQJAIAdBYE8NACAJQQZ0IAhyIQcMAgsgCEEGdCAGLQACQT9xciEIAkAgB0FwTw0AIAggCUEMdHIhBwwCCyAIQQZ0IAYtAANBP3FyIAlBEnRBgIDwAHFyIQcMAQsgB0H/AXEhBwtBASEGIANBAXENBQJAIAdBgAFJDQBBAiEGIAdBgBBJDQBBA0EEIAdBgIAESRshBgsgASAGIAJqIgI2AgQgBSACaiEDAkAgAkUNAAJAIAIgBEkNACACIARGDQEMBQsgAywAAEFASA0ECyACIARGDQEgAywAACIEQX9KDQUgBEFgSRoMBQsgASADQQFzOgAMIANBAXENBSABQQE6AA4gAEEANgIADwsgAUEAOgAMDAQLIAEoAjwiBEF/aiEKIAEoAjghBSABKAI0IQsgASgCMCEIAkACQCABKAIkIgdBf0YNACABKAIcIgkgCmoiAiALTw0BIAEoAhAiDEF/aiENQQEgDGshDiAEIAEoAhgiD2shECABKQMIIREDQAJAAkACQCARIAggAmoxAACIp0EBcQ0AIAEgCSAEaiIJNgIcDAELAkACQAJAIAcgDCAHIAxLGyICIARPDQAgAiAEIAIgBEsbIAJrIQYgBSACaiEDIAkgAmohAgNAIAMtAAAgCCACai0AAEcNAiADQQFqIQMgAkEBaiECIAZBf2oiBg0ACwsCQAJAIAcgDE8NACAIIAlqIQYgDSECA0AgAiAETw0EIAUgAmotAAAgBiACai0AAEcNAiAHIAJJIQMgAkF/aiECIAMNAAsLIAFBADYCJCAAIAk2AgQgASAJIARqIgI2AhwgACACNgIIDAwLIAEgCSAPaiIJNgIcIBAhBwwDCyAOIAJqIQkMAQsgAiAEI4GAgIAAQajCwoAAahDkgoCAAAALQQAhBwsgASAHNgIkIAkgCmoiAiALSQ0ADAILCyABKAIcIg0gCmoiAiALTw0AIAEoAhAiByAEIAcgBEsbIQ8gCCAHaiEMIAdBf2ohCSABKAIYIRAgASkDCCERA0ACQAJAIBEgCCACajEAAIhCAYNQDQAgDyEGIAUhAyANIQICQCAHIARPDQADQAJAIAMgB2otAAAgDCACai0AAEYNACACQQFqIQ0MBAsgA0EBaiEDIAJBAWohAiAHIAZBf2oiBkcNAAsLAkACQAJAIAdFDQAgCCANaiEDIAkhAgNAIAkgBE8NAyAFIAJqLQAAIAMgAmotAABHDQIgAkF/aiICQX9HDQALCyAAIA02AgQgACANIARqIgI2AgggASACNgIcDAoLIA0gEGohDQwCCyACIAQjgYCAgABBqMLCgABqEOSCgIAAAAsgASANIARqIg02AhwLIA0gCmoiAiALSQ0ACwsgASALNgIcIABBADYCAA8LQQEhAwsgASADQQFzOgAMIAUgBCACIAQjgYCAgABBoMrCgABqEPCCgIAAAAsgAiEEIAFBADoADAsgACAENgIIIAAgBDYCBAtBASECCyAAIAI2AgAL9RAECn8BfAJ+AX8jgICAgABBsAFrIgMkgICAgAAgA0EANgJ0IANCgICAgIABNwJsIANBADsBnAEgAyACNgKYASADQQA2ApQBIANBAToAkAEgA0EKNgKMASADIAI2AogBIANBADYChAEgAyACNgKAASADIAE2AnwgA0EKNgJ4IANB4ABqIANB+ABqEPSAgIAAAkACQCADKAJgIgENAEF/IQQMAQsgAygCZCECQX8hBANAIAYhBSAEIQcCQAJAA0ACQAJAIAINAEEAIQIMAQsgASACQX9qIghqLQAAQQpHDQAgAkF+aiECAkACQCAIDQBBACEEDAELIAFBACABIAJqLQAAQQ1GGyEECyACIAggBBshAiAEIAEgBBshAQsgA0HYAGogASACEJeAgIAAIAMoAlghASAFIQYgByEEAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAygCXCIIDgIPAQALIAEvAABBpcoARg0NIAhBA0kNACABLwAAQfDSAXMgAUECai0AAEHlAHNyQf//A3FFDQkgCEEGSQ0AIAEoAABB9NLR4wZzIAFBBGovAABB5cAAc3JFDQELIAghAiABLQAAQSJHDQEgAUEBaiEJIAhBf2ohBkEAIQQDQCAJIARqIQECQAJAIAYgBGsiCEEHSw0AIAYgBEYNDUEAIQIDQCABIAJqLQAAQSJGDQIgCCACQQFqIgJHDQAMDgsLIANBIGpBIiABIAgQ+YKAgAAgAygCIEEBcUUNDCADKAIkIQILAkAgAiAEaiIEIAZPDQAgCSAEai0AAEEiRw0AAkACQAJAAkACQCAEDQBBASEKQQEhAgwBC0EAIQIgBEEASA0BEJiBgIAAQQEhAiAEQQEQlYGAgAAiCkUNAQJAIARFDQAgCiAJIAT8CgAACyAEQQFqIQILAkACQCAGIAJLDQAgBiACRg0BDAQLIAkgAmosAABBQEgNAwsgA0EYaiAJIAJqIAYgAmsQl4CAgABBACEGIAMoAhghAgJAAkAgAygCHCIBDQBBACEBDAELIAItAABBOkcNACACQQFqIQIgAUF/aiEBCyADQRBqIAIgARCXgICAACADKAIUIgJBAEgNASACRQ0HIAMoAhAhARCYgYCAAEEBIQYgAkEBEJWBgIAAIghFDQEgAkUNCiAIIAEgAvwKAAAMCgsgAiAEEMeCgIAAAAsgBiACEMeCgIAAAAsgCSAGIAIgBiOBgICAAEHQyMKAAGoQ8IKAgAAACyAGIARBAWoiBE8NAAwLCwsgA0HQAGogAUEGaiAIQXpqEJeAgIAAQQAhAgJAAkACQCADKAJUIgtBAEgNAAJAIAsNAEEBIQZBASEMDAMLIAMoAlAhARCYgYCAAEEBIQIgC0EBEJWBgIAAIgYNASALIQwLIAIgDBDHgoCAAAALAkAgC0UNACAGIAEgC/wKAAALIAYhDAsgCyEEIAdBAEwNDAwICwNAIANBOGpBOiABIAIQ+oKAgAAgAygCOEEBRw0JAkAgASADKAI8IgJqLQAAQTpGDQAgAiAISw0KDAELCyADQTBqIAEgAhCXgICAAEEAIQYCQAJAIAMoAjQiBEEASA0AAkAgBA0AQQEhCgwCCyADKAIwIQkQmIGAgABBASEGIARBARCVgYCAACIKRQ0AIARFDQEgCiAJIAT8CgAADAELIAYgBBDHgoCAAAALAkAgCCACQQFqIgJNDQAgASACaiwAAEG/f0wNAgsgA0EoaiABIAJqIAggAmsQl4CAgABBACEBIAMoAiwiAkEASA0EIAINAgtBASEIQQAhAgwCCyABIAggAiAII4GAgIAAQcDIwoAAahDwgoCAAAALIAMoAighBhCYgYCAAEEBIQEgAkEBEJWBgIAAIghFDQEgAkUNACAIIAYgAvwKAAALIARFDQEgA0GgAWogCCACEIODgIAAIAMtAKABQQFGDQEgAysDqAEiDb0iDkL///////////8AgyIPUCAPQn98Qv////////8HVCAOQgBTIgFxciAPQoCAgICAgID4/wBRciAPQoCAgICAgID4/wBVciAPQoCAgICAgIB4fEKAgICAgICA8P8AVCABcXINAQJAIAJFDQAgCCACQQEQloGAgAALAkAgAygCdCIBIAMoAmxHDQAgA0HsAGoQ7ICAgAALIAMoAnAgAUEYbGoiAiAENgIQIAIgCjYCDCACIAQ2AgggAiANOQMAIAMgAUEBajYCdAwECyABIAIQx4KAgAAACwJAIAJFDQAgCCACQQEQloGAgAALIARFDQIgCiAEQQEQloGAgAAMAgsgA0HIAGogAUEDaiAIQX1qEJeAgIAAIAMoAkwiAkEGSQ0DIAMoAkgiASgAAEH00tHjBnMgAUEEai8AAEHlwABzcg0DIANBwABqIAFBBmogAkF6ahCXgICAAEEAIQICQAJAAkAgAygCRCILQQBIDQACQCALDQBBASEGQQEhEAwDCyADKAJAIQEQmIGAgABBASECIAtBARCVgYCAACIGDQEgCyEQCyACIBAQx4KAgAAACwJAIAtFDQAgBiABIAv8CgAACyAGIRALIAshBCAHQQBMDQQLIAUgB0EBEJaBgIAAIAshBAwDCyADQQhqIANB+ABqEPSAgIAAIAMoAgwhAiADKAIIIgENAAsgBSEGIAchBAwDCyAFIQYgByEECyADIANB+ABqEPSAgIAAIAMoAgQhAiADKAIAIgENAAsLAkACQCADKAJ0RQ0AIAAgAygCdDYCCCAAIAMpAmw3AgAgACALNgIUIAAgBjYCECAAIAQ2AgwMAQsgAEF/NgIAAkAgAygCbCICRQ0AIAMoAnAgAkEYbEEIEJaBgIAACyAEQQFIDQAgBiAEQQEQloGAgAALIANBsAFqJICAgIAAC6EWARZ/I4CAgIAAQfACayIDJICAgIAAIANBADYCnAEgA0KAgICAwAA3ApQBIANBADsBxAEgAyACNgLAASADQQA2ArwBIANBAToAuAEgA0EKNgK0ASADIAI2ArABIANBADYCrAEgAyACNgKoASADIAE2AqQBIANBCjYCoAEgA0GIAWogA0GgAWoQ9ICAgAACQAJAIAMoAogBIgENAEF/IQQMAQsgA0HwAWpBDGohBSADKAKMASECQX8hBANAAkACQCACDQBBACECDAELIAEgAkF/aiIGai0AAEEKRw0AIAJBfmohAgJAAkAgBg0AQQAhBwwBCyABQQAgASACai0AAEENRhshBwsgAiAGIAcbIQIgByABIAcbIQELIANBgAFqIAEgAhCXgICAAAJAAkAgAygChAEiAkUNACADKAKAASEBIAJBBUkNAQJAAkACQAJAAkACQAJAAkACQAJAAkACQCABKAAAQefCuaMHcyABQQRqIgYtAABB9ABzckUNACACQQVGDQ0gASgAAEH00tHjBnMgBi8AAEHlwABzckUNASACQQhJDQ0gASkAAELzyo2jl+2btyBSDQ0gA0H4AGogAUEIaiACQXhqEJeAgIAAQQAhASADKAJ8IgJBAEgNAyACDQJBASEIDAULIANB6ABqIAFBBWogAkF7ahCXgICAACADKAJsIgJBBkkNCyADKAJoIgEoAABB9NLR4wZzIAFBBGovAABB5cAAc3INCyADQeAAaiABQQZqIAJBemoQl4CAgABBACECIAMoAmQiCUEASA0HIAkNBkEBIQoMCgsgA0HwAGogAUEGaiACQXpqEJeAgIAAQQAhAgJAIAMoAnQiCUEASA0AAkAgCQ0AQQEhCwwKCyADKAJwIQEQmIGAgABBASECIAlBARCVgYCAACILDQUgCSELCyACIAsQx4KAgAAACyADKAJ4IQYQmIGAgABBASEBIAJBARCVgYCAACIIDQEgAiEICyABIAgQx4KAgAAACyACRQ0AIAggBiAC/AoAAAsCQCADKAKcASIGIAMoApQBRw0AIANBlAFqEOiAgIAACyADKAKYASAGQRhsaiIBQQA2AhQgAUKAgICAwAA3AgwgASACNgIIIAEgCDYCBCABIAI2AgAgAyAGQQFqNgKcAQwGCyAJRQ0DIAsgASAJ/AoAAAwDCyADKAJgIQEQmIGAgABBASECIAlBARCVgYCAACIKDQEgCSEKCyACIAoQx4KAgAAACyAJRQ0BIAogASAJ/AoAAAwBCwJAIARBAUgNACAMIARBARCWgYCAAAsgCyEMIAkhBAwBCwJAIARBAUgNACAMIARBARCWgYCAAAsgCiEMIAkhBAsgA0EIaiADQaABahD0gICAACADKAIMIQIgAygCCCIBRQ0CDAELIANBATsB7AEgAyACNgLoASADQQA2AuQBIANBAToA4AEgA0E6NgLcASADIAI2AtgBIANBADYC1AEgAyACNgLQASADIAE2AswBIANBOjYCyAEgA0HYAGogA0HIAWoQ9YCAgAACQCADKAJYIgJFDQAgA0HQAGogAiADKAJcEJeAgIAAQQAhAQJAAkAgAygCVCICQQBIDQAgAkUNAiADKAJQIQcQmIGAgABBASEBIAJBARCVgYCAACIGDQELIAEgAhDHgoCAAAALAkAgAkUNACAGIAcgAvwKAAALIANByABqIANByAFqEPWAgIAAIANBwABqIAMoAkgiAUEBIAEbIAMoAkxBACABGxCXgICAACADKAJAIQcgAygCRCEBIAMgAjYC+AEgAyAGNgL0ASADIAI2AvABIANBfzYClAIgA0KAgICAcDcChAIgA0KAgICAwAA3AvwBIANBATsBxAIgAyABNgLAAiADQQA2ArwCIANBAToAuAIgA0EsNgK0AiADIAE2ArACIANBADYCrAIgAyABNgKoAiADIAc2AqQCIANBLDYCoAIDQCADQThqIANBoAJqEPWAgIAAAkACQAJAIAMoAjgiAkUNACADQTBqIAIgAygCPBCXgICAACADKAI0IgJFDQMgAkEDSQ0DIAMoAjAiAS8AAEHpyAFzIAFBAmotAABBPXNyQf//A3FFDQIgAkEDRg0DIAEoAABB5OrJ6wNGDQEgAkEGSQ0DIAEoAABB4czRqwZzIAFBBGovAABB8sAAc3INAyADQQE7AewCIANBADYC5AIgA0EBOgDgAiADQSA2AtwCIANBADYC1AIgA0EgNgLIAiADIAJBemoiAjYC6AIgAyACNgLYAiADIAI2AtACIAMgAUEGajYCzAIgA0EoaiADQcgCahD1gICAACADKAIoIgJFDQMgAygCLCEBA0AgA0EgaiACIAEQl4CAgAACQCADKAIkIgJFDQBBACEBAkACQCACQQBIDQAgAygCICENEJiBgIAAQQEhASACQQEQlYGAgAAiDg0BIAIhDgsgASAOEMeCgIAAAAsCQCACRQ0AIA4gDSAC/AoAAAsCQCADKAKEAiIBIAMoAvwBRw0AIAUQ+oGAgAALIAMoAoACIAFBDGxqIg0gAjYCCCANIA42AgQgDSACNgIAIAMgAUEBajYChAILIANBGGogA0HIAmoQ9YCAgAAgAygCHCEBIAMoAhgiAkUNBAwACwsgAygC8AEiBkF/Rg0DIAMoAvQBIQ8gAygC/AEhByADKAKAAiEQIAMoAoQCIQEgAygCiAIhDiADKAKMAiERIAMoApQCIQ0gAygCmAIhEgJAIAMoApwBIgINAAJAIAZFDQAgDyAGQQEQloGAgAALAkAgDkEBSA0A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gIAAIANB8AFqIAMoAiAgAygCJBCDg4CAACADKwP4ASEhIAMtAPABIQIgA0EYaiABKAIIIAEoAgwQl4CAgAAgA0HwAWogAygCGCADKAIcEIODgIAAIBtFDQBEAAAAAAAA+H8gISACGyIhvUIBhkL/////////b1YNAEQAAAAAAAD4fyADKwP4ASADLQDwARsiIr1CAYZC/////////29WDQACQCADKALEASIVIAMoArwBRw0AIANBvAFqEOmAgIAACyADKALAASAVQQV0aiICIBs2AhggAiAfNgIUIAIgGzYCECACICI5AwggAiAhOQMAIAMgFUEBajYCxAEgFEUNCSABIBRBA3RBBBCWgYCAAAwJCyAURQ0EIAEgFEEDdEEEEJaBgIAADAQLIBkgFSABIAIjgYCAgABB8MjCgABqEPCCgIAAAAtBBEEgEMeCgIAAAAsgFSACQQFqIhpPDQALCyAbRQ0DIB8gG0EBEJaBgIAADAMLIBYgASACIAEjgYCAgABB4MjCgABqEPCCgIAAAAsgASACQQFqIhpPDQALCyADQRBqIANByAFqEPSAgIAAIAMoAhQhAiADKAIQIgFFDQcMBQsCQCACRQ0AIBcgFCAC/AoAAAsCQCAFQQFIDQAgIyAFQQEQloGAgAALIAIhJCAXISMgAiEFDAMLIANB8AFqIBZBB2ogAUF5aiICI4GAgIAAQdSjwIAAakEDEO6CgIAAIANBATsBuAIgAyACNgK0AiADQQA2ArACIANByAJqIANB8AFqEIWBgIAAAkAgAygC0AJBAkcNACADQZgBaiADKALMAiICKAIAIAIoAgQQl4CAgABBACECAkACQAJAIAMoApwBIglBAEgNAAJAIAkNAEEBISUMAwsgAygCmAEhARCYgYCAAEEBIQIgCUEBEJWBgIAAIiUNASAJISULIAIgJRDHgoCAAAALIAlFDQAgJSABIAn8CgAACwJAAkACQCALRQ0AIAogC0EBEJaBgIAAIAMoAtACIgJBAU0NAQsgA0GQAWogAygCzAIiAigCCCACKAIMEJeAgIAAQQAhAgJAAkAgAygClAEiBkEASA0AAkAgBg0AQQEhJgwECyADKAKQASEBEJiBgIAAQQEhAiAGQQEQlYGAgAAiJg0BIAYhJgsgAiAmEMeCgIAAAAsgBkUNASAmIAEgBvwKAAAMAQtBASACI4GAgIAAQZDJwoAAahDkgoCAAAALAkAgCEUNACAHIAhBARCWgYCAAAsgJiEHIAYhCCAlIQogCSELCyADKALIAiICRQ0CIAMoAswCIAJBA3RBBBCWgYCAAAwCCyADQfABaiAWQQdqIAFBeWoiAiOBgICAAEHUo8CAAGpBAxDugoCAACADQQE7AbgCIAMgAjYCtAIgA0EANgKwAiADQcgCaiADQfABahCFgYCAAAJAIAMoAtACQQJHDQAgA0GIAWogAygCzAIiAigCACACKAIEEJeAgIAAQQAhAgJAAkACQCADKAKMASIPQQBIDQACQCAPDQBBASEnDAMLIAMoAogBIQEQmIGAgABBASECIA9BARCVgYCAACInDQEgDyEnCyACICcQx4KAgAAACyAPRQ0AICcgASAP/AoAAAsCQAJAAkAgEUUNACAQIBFBARCWgYCAACADKALQAiICQQFNDQELIANBgAFqIAMoAswCIgIoAgggAigCDBCXgICAAEEAIQICQAJAIAMoAoQBIgxBAEgNAAJAIAwNAEEBISgMBAsgAygCgAEhARCYgYCAAEEBIQIgDEEBEJWBgIAAIigNASAMISgLIAIgKBDHgoCAAAALIAxFDQEgKCABIAz8CgAADAELQQEgAiOBgICAAEGgycKAAGoQ5IKAgAAACwJAIA5FDQAgDSAOQQEQloGAgAALICghDSAMIQ4gJyEQIA8hEQsgAygCyAIiAkUNASADKALMAiACQQN0QQQQloGAgAAMAQsgA0H4AGogFkEGaiABQXpqEJeAgIAAQQAhAgJAAkACQCADKAJ8IiRBAEgNAAJAICQNAEEBISkMAwsgAygCeCEBEJiBgIAAQQEhAiAkQQEQlYGAgAAiKQ0BICQhKQsgAiApEMeCgIAAAAsgJEUNACApIAEgJPwKAAALAkAgBUEBSA0AICMgBUEBEJaBgIAACyApISMgJCEFCyADQQhqIANByAFqEPSAgIAAIAMoAgwhAiADKAIIIgFFDQIMAAsLQQRBMBDKgoCAAAALAkACQCADKALEAUUNACAAIAMoAsQBNgJEIAAgAykCvAE3AjwgACAkNgJQIAAgIzYCTCAAIAU2AkggAEEENgI4IAAgBDYCNCAAQQQ2AjAgACAGNgIsIAAgBzYCKCAAIAg2AiQgACAJNgIgIAAgCjYCHCAAIAs2AhggACAMNgIUIAAgDTYCECAAIA42AgwgACAPNgIIIAAgEDYCBCAAIBE2AgAMAQsgAEF/NgIAAkAgAygCvAEiAkUNACADKALAASACQQV0QQgQloGAgAALAkAgBCgCACICQQFIDQAgBCgCBCACQQEQloGAgAALAkAgBCgCDCICQQFIDQAgBCgCECACQQEQloGAgAALAkAgBCgCGCICQQFIDQAgBCgCHCACQQEQloGAgAALAkAgBCgCJCICQQFIDQAgBCgCKCACQQEQloGAgAALIARBMEEEEJaBgIAAAkAgCEUNACAHIAhBARCWgYCAAAsCQCALRQ0AIAogC0EBEJaBgIAACwJAIA5FDQAgDSAOQQEQloGAgAALAkAgEUUNACAQIBFBARCWgYCAAAsgBUEBSA0AICMgBUEBEJaBgIAACyADQYADaiSAgICAAAvQBAEGfyOAgICAAEHwAGsiAiSAgICAAAJAAkACQCABLQBJDQAgASgCMCEDIAJBEGogARD/gICAAAJAAkAgAigCEEEBRw0AIAEoAkAhBCABIAIoAhg2AkAgAyAEaiEDIAIoAhQgBGshBAwBCyABLQBJDQEgAUEBOgBJAkACQCABLQBIQQFHDQAgASgCRCEEIAEoAkAhAwwBCyABKAJEIgQgASgCQCIDRg0CCyAEIANrIQQgASgCMCADaiEDCxCYgYCAAEEgQQQQlYGAgAAiBUUNAiAFIAQ2AgQgBSADNgIAIAJBATYCDCACIAU2AgggAkEENgIEIAJBEGogAUHQAPwKAAACQCACLQBZDQBBDCEDQQEhAQNAIAIoAkAhBCACQeQAaiACQRBqEP+AgIAAAkACQCACKAJkQQFHDQAgAigCUCEGIAIgAigCbDYCUCAEIAZqIQQgAigCaCAGayEGDAELIAItAFkNAiACQQE6AFkCQAJAIAItAFhBAUcNACACKAJUIQcgAigCUCEGDAELIAIoAlQiByACKAJQIgZGDQMLIAIoAkAgBmohBCAHIAZrIQYLAkAgASACKAIERw0AIAJBBGogAUEBQQRBCBCagICAACACKAIIIQULIAUgA2oiByAGNgIAIAdBfGogBDYCACACIAFBAWoiATYCDCADQQhqIQMgAi0AWUEBRw0ACwsgACACKAIMNgIIIAAgAikCBDcCAAwBCyAAQQA2AgggAEKAgICAwAA3AgALIAJB8ABqJICAgIAADwtBBEEgEMeCgIAAAAvsCAELfyOAgICAAEEgayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCiACQRhqIAEQh4GAgAAgAigCHCEBAkACQCACKAIYQQFHDQAgAkEQaiABEIiBgIAAIAIoAhQhASACKAIQQQFHDQAgAkEIaiABELOAgIAAIAIoAgwhASACKAIIIQsMAQtBACELC0EBIQMgAS0AlAEhDAJAAkACQAJAAkACQCALQQFHDQAgDEH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAxB/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgxqIgYgCE0NACAGIAhrQQFGDQcLAkAgBSAMSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBBzoAACABIANBAWo2AjAgAS0AlAEhDAwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBBzoAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakEHQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIAxB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEMAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAw2AhAgA0EANgIIIAMgBzYCBCADQYEOOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABB9MHCgABqEOSCgIAAAAsjgYCAgAAiAUG5nsCAAGpBKCABQYTCwoAAahDWgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBB0EAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkEgaiSAgICAAAvwJgEQfyOAgICAAEHwAWsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASELAkAgAUEBEKKBgIAARQ0AIAEoAhghDCACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGYAWogARDbgICAACACKAKcASEBAkAgAigCmAFBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkGQAWogARCygICAACACKAKUASEBAkAgAigCkAFBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGIAWogARCygICAACACKAKMASEBAkAgAigCiAEiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBgAFqIAEQsoCAgAAgAigChAEhAQJAIAIoAoABIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB+ABqIAEQ2oCAgAAgAigCfCEBIAIoAnhBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkHwAGogARCygICAACACKAJ0IQECQCACKAJwQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB6ABqIAEQsoCAgAAgAigCbCEBAkAgAigCaCIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHgAGogARCygICAACACKAJkIQECQCACKAJgIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB2ABqIAEQ24CAgAAgAigCXCEBIAIoAlhBAXENAAJAIAFBARCigYCAAA0AQQEhCwwBCyABKAIYIQ4gAiABKAKMATYCuAEgAiABKQKEATcDsAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhCyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkAgAUEBEKKBgIAARQ0AQQEhAwJAIAFBARCigYCAAEUNACABKAIYIRAgAiABQYQBaiILKAIINgLIASACIAspAgA3A8ABIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASAPQQFqNgJUIAEoAlAgD0EDdGoiDyANNgIEIA8gDTYCAAJAIAFBARCigYCAAEUNACABKAIYIQ8gAiALKAIINgLYASACIAspAgA3A9ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAAkACQCABQQEQooGAgABFDQAgAkHQAGogARCygICAACACKAJUIQECQCACKAJQQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJByABqIAEQsoCAgAAgAigCTCEBAkAgAigCSCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkHAAGogARCygICAACACKAJEIQECQCACKAJAIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgC0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBOGogARDagICAACACKAI8IQEgAigCOEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgACQAJAIAFBARCigYCAAEUNACACQTBqIAEQsoCAgAAgAigCNCEBAkAgAigCMEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiAiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyALQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkEYaiABENuAgIAAIAIoAhwhASACKAIYIQMLAkAgA0EBRw0AIAEgAigCyAE2AowBIAEgAikDwAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQsCQAJAIANBAXFFDQAgAyELDAELIAFBARCigYCAAEUNACACQRBqIAEQ2YCAgAAgAigCFCEBAkAgAigCEEEBcQ0AA0AgAkEIaiABENmAgIAAIAIoAgwhASACKAIIQQFxRQ0ACwsgAS0ADEECRyELCwJAIAtBAUcNACABLQAMQQJHDQELQQAhCwsCQCALQQFHDQAgASACKAK4ATYCjAEgASACKQOwATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDQJAAkACQAJAAkACQCALQQFHDQAgDUH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgYgASgCJCIDaiILIAhNDQAgCyAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAZLDQIgASAENgIwDAILIA1B/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgZqIgsgCE0NACALIAhrQQFGDQcLAkAgBSAGSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBCToAACABIANBAWo2AjAgAS0AlAEhDQwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBCToAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakEJQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIA1B/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiCy0AAA0BIAsgAzYCBCABKAKMASEGAkAgASgCGCILIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCALQRRsaiIDIAY2AhAgA0EANgIIIAMgBzYCBCADQYESOwEAIAEgC0EBajYCGAwCCyAHIAMjgYCAgABB9MHCgABqEOSCgIAAAAsjgYCAgAAiAUG5nsCAAGpBKCABQYTCwoAAahDWgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBCUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHwAWokgICAgAALmBABDn8jgICAgABB4ABrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAIAFBARCigYCAAEUNACABKAIYIQwgAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQShqIAEQioGAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiABKAKMATYCSCACIAEpAoQBNwNAIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiBBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBGGogARCygICAACACKAIcIQECQCACKAIYIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAkg2AowB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JGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQAJAAkACQAJAIAFBARCigYCAAEUNACABKAIYIQwgAiABKAKMATYCKCACIAEpAoQBNwMgIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABQYQBaiENIAEoAlAgC0EDdGoiDiADNgIEIA4gAzYCACABIAtBAWo2AlRBACELAkAgASgCjAEiA0F8Sw0AIANBA2oiDyABKAKIAUsNACANKAIAIANqIg4vAABBrdoAcyAOQQJqLQAAQT5zckH//wNxDQAgASAPNgKMAUEBIQsLAkAgAS0AgAFBAUcNABCYgYCAAEEDQQEQlYGAgAAiDkUNAiAOI4GAgIAAQdSjwIAAaiIPLQACOgACIA4gDy8AADsAACACQQM2AjwgAiAONgI4IAJCgICAgDA3AjAgASADIAJBMGogCxCggICAAAsCQAJAAkAgC0UNACABQQEQooGAgABFDQAgASgCGCEOIAIgDSgCCDYCSCACIA0pAgA3A0AgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgACQCABQQEQooGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsgAS0ADEECRg0CCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAAC0EBIQsMAQsgAUE0ahCpgICAACACIAEQpYCAgAAgAigCBCEBIAIoAgAhCwsCQCALQQFHDQAgASACKAIoNgKMASABIAIpAyA3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDgJAAkACQAJAIAtBAUcNACAOQf8BcUEBRg0IIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgBksNAiABIAQ2AjAMAgsgDkH/AXFBAUcNBSABLQCVAUUNBgJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiBmoiCyAITQ0AIAsgCGtBAUYNCQsCQCAFIAZLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQcgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEUOgAAIAEgA0EBajYCMCABLQCUASEODAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEUOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEUQQAgCiABKAJ8IAlLGxCigICAAAwBC0EBQQMQx4KAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDkH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiILLQAADQEgCyADNgIEIAEoAowBIQYCQCABKAIY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PCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghECACIAMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghDyACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQfgAaiABEK+AgIAAIAIoAnwhAQJAIAIoAnhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIREgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHwAGogARCvgICAACACKAJ0IQECQCACKAJwIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghESACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQegAaiABEK+AgIAAIAIoAmwhAQJAIAIoAmgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHgAGogARDYgICAACACKAJkIQEgAigCYCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkAgDEEBRg0AAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASEDIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQooGAgABFDQBBASEMAkAgAUEBEKKBgIAARQ0AIAEoAhghESACIAFBhAFqIgMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIQIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIBBBAWo2AlQgASgCUCAQQQN0aiIQIA02AgQgECANNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghECACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQdgAaiABEK+AgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIRIgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHQAGogARCvgICAACACKAJUIQECQCACKAJQIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBIgASgCGEsNACABIBI2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghEiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQcgAaiABEK+AgIAAIAIoAkwhAQJAIAIoAkgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgEiABKAIYSw0AIAEgEjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHAAGogARDYgICAACACKAJEIQEgAigCQCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkACQCAMQQFxRQ0AIAwhAwwBCyABQQEQooGAgABFDQAgAkE4aiABENeAgIAAIAIoAjwhAQJAIAIoAjhBAXENAANAIAJBMGogARDXgICAACACKAI0IQEgAigCMEEBcUUNAAsLIAEtAAxBAkchAwsCQCADQQFHDQAgAS0ADEECRw0BC0EAIQMLAkAgA0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCigYCAAEUNACACQShqIAEQr4CAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQSBqIAEQr4CAgAAgAigCJCEBAkAgAigCICIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAkEYaiABEK+AgIAAIAIoAhwhAQJAIAIoAhgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQQLIAEtAAxBAkYNAwsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAACyABIAIoAogBNgKMASABIAIpA4ABNwKEAQJAIAsgASgCGEsNACABIAs2AhgLIAFBNGoQqICAgAALAkAgAUEBEKKBgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCigYCAAEUNACACQRBqIAEQr4CAgAAgAigCFCEBAkAgAigCEEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghCyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQQhqIAEQr4CAgAAgAigCDCEBAkAgAigCCCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCALIAEoAhhLDQAgASALNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQsgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAiABEK+AgIAAIAIoAgQhAQJAIAIoAgAiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgCyABKAIYSw0AIAEgCzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQcLIAEtAAxBAkYNBgsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAAC0EBIQMgAS0AlAFBAUYNByABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAFBNGoiAxCpgICAACADEKmAgIAADAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEFOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEFQQAgCiABKAJ8IAlLGxCigICAAAwBCyABQTRqEKmAgIAADAELIAEtAJQBQQJHDQEgAS0AlQFFDQEgByABKAIYSw0BIAEgBzYCGAwBCwJAAkAgAS0AlAEiA0EBRw0AIAEtAJUBRQ0BAkACQCABKAKQASIDIAZHDQACQCABKAIwIgMgASgCJCIMaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgDEsNACABIAU2AiQLIAQgA0sNASABIAQ2AjAgBCEDDAELIAYgA00NAiABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCKEcNACABQShqEKGAgIAACyABKAIsIANqQQU6AAAgASADQQFqNgIwIAEtAJQBIQMLIANB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEIAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAg2AhAgA0EANgIIIAMgBzYCBCADQYEKOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABB9MHCgABqEOSCgIAAAAsjgYCAgAAiAUG5nsCAAGpBKCABQYTCwoAAahDWgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBBUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHgAWokgICAgAAL3xkBD38jgICAgABBoAFrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAIAFBARCigYCAAEUNACABKAIYIQwgAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdgAaiABEImBgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdAAaiABELKAgIAAIAIoAlQhAQJAAkAgAigCUEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ8gAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQCABQQEQooGAgABFDQAgAkHIAGogARCygICAACACKAJMIQECQCACKAJIQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEQIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBwABqIAEQsoCAgAAgAigCRCEBAkAgAigCQCIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIRAgAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkE4aiABELKAgIAAIAIoAjwhAQJAIAIoAjgiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQMLIAEtAAxBAkYNAgsgASACKAKIATYCjAEgASACKQOAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAACyABIAIoAng2AowBIAEgAikDcDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoiAxCpgICAACADEKmAgIAAIAJBMGogARC1gICAACACKAI0IQEgAigCMEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQSBqIAEQsoCAgAAgAigCJCEBAkAgAigCICIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhgiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAKIATYCjAEgASACKQOAATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkEQaiABEK+AgIAAIAIoAhQhAQJAIAIoAhBBAUcNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEgAS0AlAEiDkEBRjoAlAEgAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEIaiABEKOAgIAAIAIoAgghAyACKAIMIgEgAigCmAE2AowBIAEgAikDkAE3AoQBIAEgDjoA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DQAgACgCAEEBcUUNACAAKAIEIgIgACgCCEkNAUEAIQIgAEEAOgAMCyACDwsgACACQQFqNgIEQQEL3wEBA38jgICAgABBEGsiAySAgICAAEEAIQQCQAJAIAJBAEgNAAJAIAINAEEBIQUMAgsQmIGAgABBASEEIAJBARCVgYCAACIFRQ0AIAJFDQEgBSABIAL8CgAADAELIAQgAhDHgoCAAAALIANBBGogBSACQQ0jgYCAgAAiBEHAsMGAAGoQm4GAgAAgACADKAIIIgEgAygCDEEKIARBw7DBgABqEJuBgIAAAkAgAygCBCIARQ0AIAEgAEEBEJaBgIAACwJAIAJFDQAgBSACQQEQloGAgAALIANBEGokgICAgAALMwEBfyAAQQI6AAwgAEEANgIEIAAjgYCAgABB2NTCgABqKAIAIgE2AgggACABQQBHNgIACwkAEMGBgIAAAAtNAQF/I4CAgIAAQRBrIgYkgICAgAAgBiACNgIMIAYgATYCCCAAIAZBCGojgYCAgABB2MvCgABqIgIgBkEMaiACIAMgBCAFENWCgIAAAAsmAQF/I4GAgIAAIgBB4rXBgABqQe8AIABBkM/CgABqENuCgIAAAAsaAAJAIAAtAABBA0cNACAAQQRqEISDgIAACwsgAQF/AkAgACgCACIBRQ0AIAAoAgQgAUEBEJaBgIAACwsaAAJAIAAtAABBA0cNACAAQQRqEISDgIAACwsgAQF/AkAgACgCACIBRQ0AIAAoAgQgAUEBEJaBgIAACwsiAQF/AkAgACgCACIBQQFIDQAgACgCBCABQQEQloGAgAALCwsAIAAQroGAgAAACzoBAn8jioCAgAAoAgAhASOLgICAACECIAAoAgAgACgCBCABIAIgARsRgYCAgACAgICAABC5gYCAAAALCwAgABCwgYCAAAALqAEBA38jgICAgABBEGsiASSAgICAAAJAIAAoAgAiAigCBCIDQQFxRQ0AIAIoAgAhAiABIANBAXY2AgQgASACNgIAIAEjgYCAgABBgM3CgABqIAAoAgQgACgCCCIALQAIIAAtAAkQtIGAgAAACyABQX82AgAjgYCAgAAhAiABIAA2AgwgASACQZzNwoAAaiAAKAIEIAAoAggiAC0ACCAALQAJELSBgIAAAAu2AQICfwF+QQEhBkEEIQcCQAJAIAWtIAOtfiIIQiCI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AkACQBDMgYCAAEH/AXEOAwABAgMLIAJBEGogAkEfaiOCgICAAEGMgICAAGpBABC8gYCAACACQRBqEKiBgIAADAILIAJBEGogAkEfaiOCgICAAEGMgICAAGpBARC8gYCAACACQRBqEKiBgIAADAELIAJBEGogAkEfaiOBgICAAEHTscGAAGpBnQEQv4GAgAAgAkEQahCogYCAAAsgAUEAOgAADAELIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEHJm8CAAGogAkEQahC/gYCAACACQQRqEKiBgIAACyACQSBqJICAgIAACwkAEM2BgIAAAAu8AgMCfwF+AX8jgICAgABBIGsiAySAgICAABC7gYCAACEEIAApAgAhBSADIAI2AhggAyABNgIUIAMgBTcCDAJAAkAjkICAgAAoAgAiBkECSw0AIANBDGpBABC1gYCAAAwBCyADIAZBeGo2AhwgA0EMaiADQRxqELWBgIAACwJAAkACQAJAIAAoAggtAAAOAwABAgMLIANBDGogASACKAIkQQAQvIGAgAAgA0EMahCogYCAAAwCCyADQQxqIAEgAigCJEEBELyBgIAAIANBDGoQqIGAgAAMAQsjgYCAgABBlM7CgABqIgAtAAAhBiAAQQA6AAAgBkUNACADQQxqIAEjgYCAgABB07HBgABqQZ0BIAIoAiQRgoCAgACAgICAACADQQxqEKiBgIAACyAEQQA6AAAgA0EgaiSAgICAAAuOAQEDfyOAgICAAEEQayIAJICAgIAAI4GAgIAAQcHVwoAAaiIBLQAAIQIgAUEBOgAAIAAgAjoADwJAIAJBAUcNACOBgICAACECQQAgAEEPaiORgICAACACQaezwYAAakHBACACQdTNwoAAahCmgYCAAAALI4GAgIAAIQIgAEEQaiSAgICAACACQcHVwoAAagtgAQF/I4CAgIAAQRBrIgQkgICAgAAgBCADOgAHIAQjkoCAgACtQiCGIARBB2qthDcDCCAAIAEjgYCAgABB2oTAgABqIARBCGogAhGCgICAAICAgIAAIARBEGokgICAgAALmAMBA38jgICAgABBMGsiASSAgICAAEH/ASECAkAgAC0ADQ0AQQEhAiOBgICAAEHk1MKAAGooAgBBAUsNABDMgYCAACECCyABIAI6AAsgASAAKAIINgIMIAEgACgCACAAKAIEEM6BgIAAIAEgASkDADcCECOBgICAAEGc1cKAAGotAAAhACABIAFBC2o2AiAgASABQRBqNgIcIAEgAUEMajYCGAJAAkACQCAARQ0AI4GAgIAAIgBBnNXCgABqQQE6AAAgAEHg1MKAAGoiAigCACEAIAJBADYCACAADQELIAFBGGogAUEvaiOBgICAAEGYzsKAAGoQuoGAgAAMAQsjgYCAgAAhAiABQRhqIABBCGoQyYGAgAAiA0EEaiACQcDOwoAAahC6gYCAACADQQA6AAAgAkGc1cKAAGpBAToAACACQeDUwoAAaiIDKAIAIQIgAyAANgIAIAEgAjYCKCABQQE2AiQgAkUNACACIAIoAgAiAEF/ajYCACAAQQFHDQAgAUEkakEEahDKgYCAAAsgAUEwaiSAgICAAAtuAQF/I4CAgIAAQSBrIgIkgICAgAAgAiAAIAEQpYGAgAA2AgQgAiOPgICAAK1CIIYgAkEEaq2ENwMQIAJBCGogAkEfaiOBgICAAEGpnMCAAGogAkEQahC/gYCAACACQQhqEKiBgIAAELmBgIAAAAu5AQEBfyOAgICAAEEQayIEJICAgIAAIABB/wE6AAAgBCABNgIIIAQgACkCADcDACAEI4GAgIAAQajMwoAAaiACIAMQ2oKAgAAhASAELQAAIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQcawwYAAakGtASAEQYDMwoAAahDbgoCAAAALIANB/wFxQQNHDQEgBEEEchCEg4CAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAALcQEBfyOAgICAAEEQayICJICAgIAAAkACQAJAIAFBCEsNACABIABNDQELIAJBADYCDCACQQxqIAFBBCABQQRLGyAAEMKCgIAAIQFBACACKAIMIAEbIQEMAQsgABC6goCAACEBCyACQRBqJICAgIAAIAELCQAQuYGAgAAACwoAIAAQvYKAgAALnQEBAn8jgICAgABBEGsiBCSAgICAAAJAAkACQCACQQhLDQAgAiADTQ0BC0EAIQUgBEEANgIMIARBDGogAkEEIAJBBEsbIAMQwoKAgAANASAEKAIMIgJFDQECQCADIAEgAyABSRsiA0UNACACIAAgA/wKAAALIAAQvYKAgAAgAiEFDAELIAAgAxDAgoCAACEF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IAZCzM7O7+/OwO/xAIWEQgBRDQAgAkGStMGAAGohAUEMIQIMAgsgAUEEaiEFQQghAgsgASACaigCACECIAUoAgAhAQsgACACNgIEIAAgATYCACADQRBqJICAgIAAC9oCAQV/I4CAgIAAQRBrIgQkgICAgAACQAJAIANFDQAgBEEMaiEFA0ACQAJAAkACQAJAQQIgAiADEIKCgIAAIgZBf0cNACOBgICAACEHI5OAgIAAKAIAIQgjlICAgAAoAgAhBgJAIAggB0G4zcKAAGpGDQAjgYCAgABBuM3CgABqEICDgIAACyAEQQA6AAsgBEEAOwAJIAQgBjYCDCAEQQA6AAggBhD7goCAACgCCBGAgICAAICAgIAADQMgBEEIaiEGDAELIARB/wE6AAggBCAGNgIMI4GAgIAAIQcgBg0BIAdB+M7CgABqIQYLIAAgBikCADcCAAwFCwJAIAMgBkkNACACIAZqIQIgAyAGayEDDAILIAYgAyADI4GAgIAAQdDPwoAAahDcgoCAAAALIAQtAAhBA0cNACAFEISDgIAACyADDQALCyAAQf8BOgAACyAEQRBqJICAgIAAC20BAn8jlYCAgAAiASABKAIAIgJBAWo2AgBBACEBAkAgAkEASA0AQQEhASOBgICAAEHo1MKAAGotAAANACOBgICAACIBQejUwoAAaiAAOgAAIAFB5NTCgABqIgEgASgCAEEBajYCAEECIQELIAELHAAgACgCACABIAAoAgQoAgwRhICAgACAgICAAAsKACAAEP6BgIAACwcAIABBG0YLLwEBf0ErIQECQCAAQX9qIgBBygBLDQAjgYCAgABBv7bBgABqIABqLQAAIQELIAELJQEBfyAAI4GAgIAAQbSywYAAaiICKQIINwIIIAAgAikCADcCAAslAQF/IAAjgYCAgABBpLLBgABqIgIpAgg3AgggACACKQIANwIAC8EBBAN/AX4CfwF+QQAhAwJAQQAgACgCCCIEKAIEIgUgBCkDCCIGQv////8PIAZC/////w9UG6drIgcgByAFSxsiByACIAcgAkkbIghFDQAgBCgCACAGIAWtIgkgBiAJVBunaiABIAj8CgAACyAEIAYgCK18NwMIAkAgByACTw0AI4GAgIAAQfjOwoAAaikDACIGQv8Bg0L/AVENAAJAIAAtAABBA0cNACAAQQRqEISDgIAACyAAIAY3AgBBASEDCyADC2MBAX8CQAJAAkAgAiAAKAIIIgAoAgAgACgCCCIDa00NACAAIAMgAkEBQQEQsoGAgAAgACgCCCEDDAELIAJFDQELIAJFDQAgACgCBCADaiABIAL8CgAACyAAIAMgAmo2AghBAAtpAQF/I4CAgIAAQRBrIgMkgICAgAAgA0EIaiADIAEgAhDPgYCAAAJAIAMtAAgiAkH/AUYNAAJAIAAtAABBA0cNACAAQQRqEISDgIAACyAAIAMpAwg3AgALIANBEGokgICAgAAgAkH/AUcLtwUBCH8jgICAgABBEGsiBCSAgICAAAJAAkACQAJAAkACQCADRQ0AIAJBBGohBSADQQN0IgZBeGpBA3ZBAWohB0EAIQgCQANAIAUoAgANASAFQQhqIQUgCEEBaiEIIAZBeGoiBg0ACyAHIQgLIAMgCEkNAiADIAhGDQAgAyAIayEHIAIgCEEDdGohCSAEQQhqQQRqIQoDQAJAAkBBAiAJIAdBECAHQRBJGxCBgoCAACIFQX9HDQAjgYCAgAAhCCOTgICAACgCACEGI5SAgIAAKAIAIQUCQCAGIAhBuM3CgABqRg0AI4GAgIAAQbjNwoAAahCAg4CAAAsgBEEAOgALIARBADsACSAEIAU2AgwgBEEAOgAIIAUQ+4KAgAAoAggRgICAgACAgICAAA0BIARBCGohBQwHCyAEQf8BOgAIIAQgBTYCDCOBgICAACEIAkAgBQ0AIAhB+M7CgABqIQUMBwsgCUEEaiEIIAdBA3QiA0F4akEDdkEBaiELQQAhBgJAA0AgBSAIKAIAIgJJDQEgCEEIaiEIIAZBAWohBiAFIAJrIQUgA0F4aiIDDQALIAshBgsgByAGSQ0FIAkgBkEDdGohCQJAIAcgBkcNAEEAIQcgBUUNASOBgICAACIFQeqzwYAAakHPACAFQfTNwoAAahDbgoCAAAALIAkoAgQiCCAFSQ0DIAcgBmshByAJIAggBWs2AgQgCSAJKAIAIAVqNgIACwJAIAQtAAhBA0cNACAKEISDgIAACyAHDQALCyAAQf8BOgAADAQLI4GAgIAAIgVBx7PBgABqQccAIAVB5M3CgABqENuCgIAAAAsgCCADIAMjgYCAgABBhM7CgABqENyCgIAAAAsgBiAHIAcjgYCAgABBhM7CgABqENyCgIAAAAsgACAFKQIANwIACyAEQRBqJICAgIAAC0QAAkAgACgCAEF/Rg0AIAEgACgCBCAAKAIIEO2CgIAADwsgASgCACABKAIEIAAoAgwoAgAiACgCACAAKAIEENqCgIAACxsAIAAjgYCAgABBoM/CgABqNgIEIAAgATYCAAsMACAAIAEpAgA3AwALWwECfyABKAIEIQIgASgCACEDEJiBgIAAAkBBCEEEEJWBgIAAIgENAEEEQQgQyoKAgAAACyABIAI2AgQgASADNgIAIAAjgYCAgABBoM/CgABqNgIEIAAgATYCAAsPACAAKAIAIAEQhYOAgAALFAAgASAAKAIAIAAoAgQQ7YKAgAALkwEBAX8CQEECIAIgA0EQIANBEEkbEIGCgIAAIgNBf0cNACOBgICAACEDI5OAgIAAKAIAIQIjlICAgAAoAgAhBAJAIAIgA0G4zcKAAGpGDQAjgYCAgABBuM3CgABqEICDgIAACyAAQQA7AAEgACAENgIEIABBADoAACAAQQNqQQA6AAAPCyAAQf8BOgAAIAAgAzYCBAsEAEEBCwoAIABB/wE6AAALiwEBAX8CQEECIAIgAxCCgoCAACIDQX9HDQAjgYCAgAAhAyOTgICAACgCACECI5SAgIAAKAIAIQQCQCACIANBuM3CgABqRg0AI4GAgIAAQbjNwoAAahCAg4CAAAsgAEEAOwABIAAgBDYCBCAAQQA6AAAgAEEDakEAOgAADwsgAEH/AToAACAAIAM2AgQL+wIBBX8CQAJAIAMNAEEAIQQMAQsgA0EDcSEFQQAhBkEAIQQCQAJAIANBBEkNACACQRxqIQcgA0H8////AHEhCEEAIQRBACEGA0AgBygCACAHQXhqKAIAIAdBcGooAgAgB0FoaigCACAEampqaiEEIAdBIGohByAIIAZBBGoiBkcNAAsgBUUNAQsgBkEDdCACakEEaiEHA0AgBygCACAEaiEEIAdBCGohByAFQX9qIgUNAAsLIANBA3QhBwJAIAQgASgCACABKAIIIgVrTQ0AIAEgBSAEQQFBARCygYCAAAsgAiAHaiEDIAEoAgAhCCABKAIIIQUDQCACKAIAIQYCQAJAAkAgAkEEaigCACIHIAggBWtNDQAgASAFIAdBAUEBELKBgIAAIAEoAgAhCCABKAIIIQUMAQsgB0UNAQsgB0UNACABKAIEIAVqIAYgB/wKAAALIAEgBSAHaiIFNgIIIAJBCGoiAiADRw0ACwsgAEH/AToAACAAIAQ2AgQLBABBAQvuAgEFfwJAIANFDQAgA0EDcSEEQQAhBUEAIQYCQAJAIANBBEkNACACQRxqIQcgA0H8////AHEhCEEAIQVBACEGA0AgBygCACAHQXhqKAIAIAdBcGooAgAgB0FoaigCACAGampqaiEGIAdBIGohByAIIAVBBGoiBUcNAAsgBEUNAQsgBUEDdCACakEEaiEHA0AgBygCACAGaiEGIAdBCGohByAEQX9qIgQNAAsLIANBA3QhBwJAIAYgASgCACIFIAEoAggiBGtNDQAgASAEIAZBAUEBELKBgIAAIAEoAgAhBSABKAIIIQQLIAIgB2ohCANAIAIoAgAhBgJAAkACQCACQQRqKAIAIgcgBSAEa00NACABIAQgB0EBQQEQsoGAgAAgASgCACEFIAEoAgghBAwBCyAHRQ0BCyAHRQ0AIAEoAgQgBGogBiAH/AoAAAsgASAEIAdqIgQ2AgggAkEIaiICIAhHDQALCyAAQf8BOgAACwoAIABB/wE6AAALawEBfwJAAkACQCADIAEoAgAgASgCCCIEa00NACABIAQgA0EBQQEQsoGAgAAgASgCCCEEDAELIANFDQELIANFDQAgASgCBCAEaiACIAP8CgAACyAAIAM2AgQgAEH/AToAACABIAQgA2o2AggLZAEBfwJAAkACQCADIAEoAgAgASgCCCIEa00NACABIAQgA0EBQQEQsoGAgAAgASgCCCEEDAELIANFDQELIANFDQAgASgCBCAEaiACIAP8CgAACyAAQf8BOgAAIAEgBCADajYCCAueAgEGfyAAKAIIIQICQAJAIAFBgAFPDQBBASEDDAELAkAgAUGAEE8NAEECIQMMAQtBA0EEIAFBgIAESRshAwsCQCADIAAoAgAgAmtNDQAgACACIANBAUEBELKBgIAACyAAKAIEIAJqIQQCQAJAIAFBgAFJDQAgAUE/cUGAf3IhBSABQQZ2IQYCQCABQYAQTw0AIAQgBToAASAEIAZBwAFyOgAADAILIAFBDHYhByAGQT9xQYB/ciEGAkAgAUH//wNLDQAgBCAFOgACIAQgBjoAASAEIAdB4AFyOgAADAILIAQgBToAAyAEIAY6AAIgBCAHQT9xQYB/cjoAASAEIAFBEnZBcHI6AAAMAQsgBCABOgAACyAAIAMgAmo2AghBAAteAQF/AkACQAJAIAIgACgCACAAKAIIIgNrTQ0AIAAgAyACQQFBARCygYCAACAAKAIIIQMMAQsgAkUNAQsgAkUNACAAKAIEIANqIAEgAvwKAAALIAAgAyACajYCCEEAC68BAgJ/AX4jgICAgABBIGsiAiSAgICAAAJAIAEoAgBBf0cNACABKAIMIQMgAkEANgIcIAJCgICAgBA3AhQgAkEUaiOBgICAAEHozMKAAGogAygCACIDKAIAIAMoAgQQ2oKAgAAaIAIgAigCHCIDNgIQIAIgAikCFCIENwMIIAEgAzYCCCABIAQ3AgALIAAgATYCACAAI4GAgIAAQbDPwoAAajYCBCACQSBqJICAgIAAC5MCAgJ/AX4jgICAgABBIGsiAiSAgICAAAJAIAEoAgBBf0cNACABKAIMIQMgAkEANgIYIAJCgICAgBA3AhAgAkEQaiOBgICAAEHozMKAAGogAygCACIDKAIAIAMoAgQQ2oKAgAAaIAIgAigCGCIDNgIIIAIgAikCECIENwMAIAEgAzYCCCABIAQ3AgALIAEoAgghAyABQQA2AgggASkCACEEIAFCgICAgBA3AgAgAiADNgIYIAIgBDcDEBCYgYCAAAJAQQxBBBCVgYCAACIBDQBBBEEMEMqCgIAAAAsgASACKAIYNgIIIAEgAikDEDcCACAAI4GAgIAAQbDPwoAAajYCBCAAIAE2AgAgAkEgaiSAgICAAAu5AQEBfyOAgICAAEEQayIEJICAgIAAIABB/wE6AAAgBCABNgIIIAQgACkCADcDACAEI4GAgIAAQZDMwoAAaiACIAMQ2oKAgAAhASAELQAAIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQcawwYAAakGtASAEQYDMwoAAahDbgoCAAAALIANB/wFxQQNHDQEgBEEEchCEg4CAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAALCQAgAEEANgIAC6EDBAV/AX4BfwF+I4CAgIAAQRBrIgIkgICAgAAgAkEANgIMAkACQCABQYABSQ0AIAFBP3FBgH9yIQMgAUEGdiEEAkAgAUGAEE8NACACIAM6AA0gAiAEQcABcjoADEECIQEMAgsgAUEMdiEFIARBP3FBgH9yIQQCQCABQf//A0sNACACIAM6AA4gAiAEOgANIAIgBUHgAXI6AAxBAyEBDAILIAIgAzoADyACIAQ6AA4gAiAFQT9xQYB/cjoADSACIAFBEnZBcHI6AAxBBCEBDAELIAIgAToADEEBIQELQQAhBgJAQQAgACgCCCIDKAIEIgUgAykDCCIHQv////8PIAdC/////w9UG6drIgQgBCAFSxsiBCABIAQgAUkbIghFDQAgAygCACAHIAWtIgkgByAJVBunaiACQQxqIAj8CgAACyADIAcgCK18NwMIAkAgBCABTw0AI4GAgIAAQfjOwoAAaikDACIHQv8Bg0L/AVENAAJAIAAtAABBA0cNACAAQQRqEISDgIAACyAAIAc3AgBBASEGCyACQRBqJICAgIAAIAYLGwAgACOBgICAAEHoy8KAAGogASACENqCgIAAC7kCAQR/I4CAgIAAQRBrIgIkgICAgAAgAkEANgIMAkACQCABQYABSQ0AIAFBP3FBgH9yIQMgAUEGdiEEAkAgAUGAEE8NACACIAM6AA0gAiAEQcABcjoADEECIQEMAgsgAUEMdiEFIARBP3FBgH9yIQQCQCABQf//A0sNACACIAM6AA4gAiAEOgANIAIgBUHgAXI6AAxBAyEBDAILIAIgAzoADyACIAQ6AA4gAiAFQT9xQYB/cjoADSACIAFBEnZBcHI6AAxBBCEBDAELIAIgAToADEEBIQELAkAgASAAKAIIIgAoAgAgACgCCCIDa00NACAAIAMgAUEBQQEQsoGAgAAgACgCCCEDCwJAIAFFDQAgACgCBCADaiACQQxqIAH8CgAACyAAIAMgAWo2AgggAkEQaiSAgICAAEEACxsAIAAjgYCAgABBkMzCgABqIAEgAhDagoCAAAutAgEEfyOAgICAAEEQayICJICAgIAAIAJBADYCBAJAAkAgAUGAAUkNACABQT9xQYB/ciEDIAFBBnYhBAJAIAFBgBBPDQAgAiADOgAFIAIgBEHAAXI6AARBAiEBDAILIAFBDHYhBSAEQT9xQYB/ciEEAkAgAUH//wNLDQAgAiADOgAGIAIgBDoABSACIAVB4AFyOgAEQQMhAQwCCyACIAM6AAcgAiAEOgAGIAIgBUE/cUGAf3I6AAUgAiABQRJ2QXByOgAEQQQhAQwBCyACIAE6AARBASEBCyACQQhqIAIgAkEEaiABEM+BgIAAAkAgAi0ACCIBQf8BRg0AAkAgAC0AAEEDRw0AIABBBGoQhIOAgAALIAAgAikDCDcCAAsgAkEQaiSAgICAACABQf8BRwsbACAAI4GAgIAAQajMwoAAaiABIAIQ2oKAgAALxwEBAn8jgICAgABBoAhrIgIkgICAgAAgAkEUakEAQYAI/AsAAkAgACACQRRqQYAIELaCgIAAQX9MDQAgAkGUCGogAkEUaiACQRRqELeCgIAAEMmCgIAAIAJBCGogAkGUCGoQ0IKAgAAgASACKAIMIgMgAigCEBDtgoCAACEAAkAgAigCCCIBRQ0AIAMgAUEBEJaBgIAACyACQaAIaiSAgICAACAADwsjgYCAgAAiAkHQtcGAAGpBJSACQYDPwoAAahDbgoCAAAALGwAgACOBgICAAEHozMKAAGogASACENqCgIAAC0YAAkACQAJAIAENACADRQ0CEJiBgIAAIAMgAhCVgYCAACICRQ0BDAILIAAgASACIAMQl4GAgAAiAg0BCxDNgYCAAAALIAILUQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGogACAAKAIAQQwQ+4GAgAACQCABKAIIIgBBf0YNACAAIAEoAgwQx4KAgAAACyABQRBqJICAgIAAC54BAQJ/I4CAgIAAQRBrIgQkgICAgAAgBEEEaiABKAIAIgUgASgCBCACQQFqIgIgBUEBdCIFIAIgBUsbIgJBBCACQQRLGyICIAMQ/IGAgAACQAJAIAQoAgRFDQAgBCgCDCEBIAQoAgghAgwBCyAEKAIIIQMgASACNgIAIAEgAzYCBEF/IQILIAAgATYCBCAAIAI2AgAgBEEQaiSAgICAAAuzAQICfwF+QQEhBUEEIQYCQAJAIAStIAOtfiIHQiCIp0UNAEEAIQMMAQsCQCAHpyIDQfz///8HTQ0AQQAhAwwBCwJAAkACQAJAIAFFDQAgAiAEIAFsQQQgAxCXgYCAACEGDAELAkAgAw0AQQQhBgwCCxCYgYCAACADQQQQlYGAgAAhBgsgBg0AIABBBDYCBAwBCyAAIAY2AgRBACEFC0EIIQYLIAAgBmogAzYCACAAIAU2AgALAgALPAEBfyOAgICAAEEQayIBJICAgIAAIAEQgICAgAAgACABKQMINwMIIAAgASkDADcDACABQRBqJICAgIAACzIAAkAgAUUNACOBgICAACIBQYq3wYAAakE5IAFB3NDCgABqENuCgIAAAAsgAEEANgIACyMAAkAgAUUNACACIAMQyoKAgAAACyAAIAM2AgQgACACNgIAC2MBAX8CQCACQQBIDQACQCACRQ0AA0ACQCABQQRqKAIAIgNFDQAgACABKAIAIAMQgoKAgAAPCyABQQhqIQEgAkF/aiICDQALCyAAQQBBABCCgoCAAA8LI5SAgIAAQRw2AgBBfwu4AQEEfyOAgICAAEEgayIDJICAgIAAQX8hBAJAIAAQiYKAgAAiAEUNAAJAIAAoAgQiBSgCCCIGRQ0AAkAgACgCACADQQhqIAYRhICAgACAgICAAEEATg0AQX8hBAwCCyADQQhqIAEgAhCKgoCAACEEDAELAkAgBSgCSCIGRQ0AIAAoAgAgASACQQBBAEEAIAYRhYCAgACAgICAACEEDAELI5SAgIAAQTo2AgALIANBIGokgICAgAAgBAsrAQF/I4CAgIAAQRBrIgEkgICAgAAgASAAQQBHOgAPIAFBD2oQl4KAgAAACyAAAkAjgYCAgABB7NDCgABqKAIAQX9HDQAQhYKAgAALC/0CAQx/I4CAgIAAQRBrIgAkgICAgAAjgYCAgAAhASAAQQhqEJaCgIAAAkACQAJAIAAoAgwiAg0AIAFByNXCgABqIQMMAQsgAkEBaiIBRQ0BIAFBBBC/goCAACIDRQ0BIAAoAgghASADIQRBACEFA0AgAUEIaigCACEGIAEoAgAhByAEIAFBDGooAgAiCCABQQRqKAIAIglqIgpBAmoQuoKAgAAiCzYCAAJAIAsNAAJAIAVFDQAgAyEBA0AgASgCABC9goCAACABQQRqIQEgBUF/aiIFDQALCyADEL2CgIAADAMLAkAgCUUNACALIAcgCfwKAAALIAsgCWoiCUE9OgAAAkAgCEUNACAJQQFqIAYgCPwKAAALIAsgCmpBAWpBADoAACABQRBqIQEgBEEEaiEEIAIgBUEBaiIFRw0ACyAAQQhqEIuCgIAACyOBgICAAEHs0MKAAGogAzYCACAAQRBqJICAgIAADwsgAEEIahCLgoCAAEHGABCDgoCAAAALAwAAC2oBAX8jgYCAgABB8NDCgABqKAIAIQICQAJAIAANACACELKCgIAAIgANASOUgICAAEEwNgIAQQAPCwJAIAEgAhC3goCAAEEBak8NACOUgICAAEHEADYCAEEADwsgACACELGCgIAAIQALIAAL/QIDA38BfgF/AkACQAJAI4GAgIAAQczVwoAAai0AAA0AI4GAgIAAQczVwoAAakEBOgAAEKaCgIAAQX9KDQAgACgCACEBIAAoAgQhAgwBCyOBgICAACEDIAApAgAiBEIgiKchAiAEpyEBAkACQCADQdDVwoAAaiIDKAIEIgAgAygCCEcNACOBgICAAEHQ1cKAAGoiBSgCACEDAkAgACAFKAIMRw0AIAMgAEEBdEEIIAAbIgVBDGwQwIKAgAAiA0UNAiOBgICAAEHQ1cKAAGoiACAFNgIMIAAgAzYCACAAKAIIIQALIAMgAEEMbGoiAyAAQQFqNgIEIANBADoAACOBgICAAEHQ1cKAAGoiACAAKAIIQQFqNgIIIAAoAgQhAAsjgYCAgABB0NXCgABqIgMgAygCACAAQQxsaiIDKAIENgIEIANBAToAACADIAQ3AgQgAEF/Sg0CDAELI5SAgIAAQTA2AgALIAEgAigCABGGgICAAICAgIAAQX8hAAsgAAuoAQEBfwJAAkAjgYCAgABBzNXCgABqLQAADQAjgYCAgABBzNXCgABqQQE6AABBACEBEKaCgIAAQQBIDQELI4GAgIAAIQECQAJAIABBAEgNACAAIAFB0NXCgABqKAIISQ0BCyOUgICAAEEINgIAQQAPCwJAI4GAgIAAQdDVwoAAaigCACAAQQxsaiIALQAADQAjlICAgABBCDYCAEEADwsgAEEEaiEBCyABC4IFAwF/An4CfyOAgICAAEEwayIDJICAgIAAAkACQCAAKAIQIANBIGogA0EoahCagoCAAEUNAAJAAkACQANAAkAgAykDICIEUA0AIAMgBCACrSIFIAQgBVQbIgQ3AyAgAyAEPgIcIAMgATYCGAJAIAAoAhAgA0EYaiADQShqEJuCgIAADQAgAy0AKEEBRw0DQcAAIQYMBAsgAC0ABEEBRw0EIAAoAhAgA0EoahCcgoCAAA0EIAMtAChBAUcNAkHAACEGDAMLAkAgAC0ABA0AI5SAgIAAQQY2AgBBfyEGDAYLAkAgACgCFCIHKAIAIgYNACAHIAAoAhAQnYKAgAA2AgAgACgCFCgCACEGCyAGEI6CgIAAIQYCQAJAAkAgACkDCCIEUA0AIAQQpIKAgAAhByADIAY2AhAgAyADQRBqNgIYIAcQjoKAgAAhBiADQQI2AhwgAyAGNgIUIANBGGogA0EIahCZgoCAACAHEI2CgIAAIAMoAgwiB0UNASADKAIIIQYCQANAIAYoAgBBAUYNASAGQQRqIQYgB0F/aiIHRQ0DDAALCyOUgICAAEEGNgIAIANBCGoQj4KAgABBfyEGDAgLIAYQmIKAgAAMAQsgA0EIahCPgoCAAAsgACgCECADQSBqIANBKGoQmoKAgAANAAwECwsgAygCLBCMgoCAAEEdIQYLI5SAgIAAIAY2AgBBfyEGDAILIAMpAyAiBKciBkEBSA0BIAAoAgAiB0UNASAHIAcpAwAgBEL/////B4N8NwMADAELQcAAIQYCQCADLQAoQQFGDQAgAygCLBCMgoCAAEEdIQYLI5SAgIAAIAY2AgBBfyEGCyADQTBqJICAgIAAIAYLewECfwJAIAAoAgQiAUUNACAAKAIAIgIhAANAAkAgAEEEaigCAEUNACAAKAIAEL2CgIAACyAAQgA3AgACQCAAQQxqKAIARQ0AIABBCGooAgAQvYKAgAALIABBCGpCADcCACAAQRBqIQAgAUF/aiIBDQALIAIQvYKAgAALCwoAIAAQgYCAgAALCgAgABCCgICAAAsEACAACxgAAkAgACgCBEUNACAAKAIAEL2CgIAACwsKACAAEIOAgIAACwQAIAALCgAgABCEgICAAAsEACAACwoAIAAQhYCAgAALCgAgABCGgICAAAs1AQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCHgICAACAAIAEpAgg3AgAgAUEQaiSAgICAAAsOACAALQAAEIiAgIAAAAsKACAAEImAgIAACz8BAX8jgICAgABBEGsiAiSAgICAACAAKAIAIAAoAgQgAkEIahCKgICAACABIAIpAgg3AgAgAkEQaiSAgICAAAt3AgF/AX4jgICAgABBEGsiAySAgICAACAAIAMQi4CAgAACQAJAAkACQCADLQAADgIAAgELIAMpAwghBAsgASAENwMAQQEhAAwBCyACIAM1AgxCIIZCACADMQAIIgRQGyAEhDcCAEEAIQALIANBEGokgICAgAAgAAtcAQF/I4CAgIAAQRBrIgMkgICAgAAgACABKAIAIAEoAgQgA0EEahCMgICAAAJAIAMtAARBAUciAQ0AIAIgAy0ACDoAACACIAMoAgw2AgQLIANB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AQwBCyODgICAACAAQf8BcWotAABBAnFBAXYhAQsgAUEBcQvsAgEFf0EAIQEjgYCAgABBzODBgABqIgIgAkEAQRAgAEGrnQRJGyIDIANBCHIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBBHIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAnIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQf8FIQQCQAJAIANBH0sNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQf7SwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuvAgEFf0EAIQEjgYCAgABB0OHBgABqIgIgAkEAQQYgAEGA/ANJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQSMhBAJAAkAgA0EKSw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABB/djBgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC68CAQV/QQAhASOBgICAAEGA4sGAAGoiAiACQQBBBSAAQb2hBEkbIgMgA0EDaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgNBAnRqKAIAQQt0IgIgAEELdCIERiACIARJaiADaiIDQQJ0aiIFKAIAQRV2IQJBKyEEAkACQCADQQlLDQAgBSgC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CX4gBSAGVK1CIIYgBUIgiIR8IAogB1StfCAEIAF+IAMgAn58fDcDCAsL29QCAgBBgIDAAAvvwQIBUcAAwAE6wAE6wAAJcXVhZHJhbnQtwAAWc2xpY2UgaW5kZXggc3RhcnRzIGF0IMANIGJ1dCBlbmRzIGF0IMAAFWJ5dGUgcmFuZ2Ugc3RhcnRzIGF0IMANIGJ1dCBlbmRzIGF0IMAAIGluZGV4IG91dCBvZiBib3VuZHM6IHRoZSBsZW4gaXMgwBIgYnV0IHRoZSBpbmRleCBpcyDAAMAFLCBvciDAAMAEIG9yIMAAEXN0YXJ0IGJ5dGUgaW5kZXggwCcgaXMgb3V0IG9mIGJvdW5kcyBmb3Igc3RyaW5nIG9mIGxlbmd0aCDAAA9lbmQgYnl0ZSBpbmRleCDAJyBpcyBvdXQgb2YgYm91bmRzIGZvciBzdHJpbmcgb2YgbGVuZ3RoIMAAEnJhbmdlIHN0YXJ0IGluZGV4IMAiIG91dCBvZiByYW5nZSBmb3Igc2xpY2Ugb2YgbGVuZ3RoIMAAEHJhbmdlIGVuZCBpbmRleCDAIiBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDAAAt1bmV4cGVjdGVkIMAAC3VuZXhwZWN0ZWQgwAs7IGV4cGVjdGVkIMAACWV4cGVjdGVkIMAAEGFzc2VydGlvbiBgbGVmdCDAFyByaWdodGAgZmFpbGVkCiAgbGVmdDogwAkKIHJpZ2h0OiDAABBhc3NlcnRpb24gYGxlZnQgwBAgcmlnaHRgIGZhaWxlZDogwAkKICBsZWZ0OiDACQogcmlnaHQ6IMAAFW1lcm1haWQgcGFyc2UgZXJyb3I6IMAAwAI6IMAAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9pby9lcnJvci91bml4LnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL2luZGV4LnJzAC9ydXN0L2RlcHMvaGFzaGJyb3duLTAuMTcuMS9zcmMvcmF3LnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC9zaGFyZWQvc21hbGxzb3J0LnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc3RhYmxlL3F1aWNrc29ydC5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvcXVhZHJhbnQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlycy5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvdHlwZXMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL211dGV4L25vX3RocmVhZHMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL3J3bG9jay9ub190aHJlYWRzLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHIucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvZXJyb3IucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvaXRlcmF0b3JzL3BhaXIucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tZW1jaHIucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9udW0vaW1wL2RlYzJmbHQvZGVjaW1hbF9zZXEucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvc3RyL3BhdHRlcm4ucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zdHIvcGF0dGVybi5ycwAvbW50L3dvcmsvcnVubmVyLXNoYXJlZC9jYXJnby1ob21lL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9wZXN0LTIuOS42L3NyYy9wb3NpdGlvbi5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvY2xhc3NfZGlhZ3JhbS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vd3JpdGUucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvcGFyc2VyX3N0YXRlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvbnVtL2ltcC9kZWMyZmx0L3BhcnNlLnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC9waWUucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL3NlcXVlbmNlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zdHIvbW9kLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMvbW9kLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvaWQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS9yZXByX2lvdmVjLnJzAMABOgAvABFzdGFydCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAPZW5kIGJ5dGUgaW5kZXggwCYgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlIMAIIChieXRlcyDACyBvZiBzdHJpbmcpAAlxdWFkcmFudC3AASAAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMBHIGJ5dGVzIGZhaWxlZApza2lwcGluZyBiYWNrdHJhY2UgcHJpbnRpbmcgdG8gYXZvaWQgcG90ZW50aWFsIHJlY3Vyc2lvbgoANWZhdGFsIHJ1bnRpbWUgZXJyb3I6IGZhaWxlZCB0byBpbml0aWF0ZSBwYW5pYywgZXJyb3IgwAssIGFib3J0aW5nCgAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwA4gYnl0ZXMgZmFpbGVkCgAMcGFuaWNrZWQgYXQgwAI6CsAzCnRocmVhZCBwYW5pY2tlZCB3aGlsZSBwcm9jZXNzaW5nIHBhbmljLiBhYm9ydGluZy4KAAkKdGhyZWFkICfAAycgKMAOKSBwYW5pY2tlZCBhdCDAAjoKwAEKABlhYm9ydGluZyBkdWUgdG8gcGFuaWMgYXQgwAI6CsABCgB1bmtub3duIHBhcnNpbmcgZXJyb3JpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlZmF0YWwgcnVudGltZSBlcnJvcjogQXR0ZW1wdGVkIHRvIGluaXRpYWxpemUgdGhyZWFkLWxvY2FsIHdoaWxlIGl0IGlzIGJlaW5nIGRyb3BwZWQsIGFib3J0aW5nCgD//////////2F0dGVtcHQgdG8gam9pbiBpbnRvIGNvbGxlY3Rpb24gd2l0aCBsZW4gPiB1c2l6ZTo6TUFYY2FsbCBsaW1pdCByZWFjaGVkc3RhY2sgbGltaXQgcmVhY2hlZFREQlRMUlJMcmVjdHJvdW5kZWRkaWFtb25kY2lyY2xlaWRsYWJlbHNoYXBlYXJyb3dsaW5lc291cmNldGFyZ2V0ZWRnZVR5cGVraW5kdmFyaWFudGRpcmVjdGlvbm5vZGVzZWRnZXN0aXRsZXhBeGlzTGVmdHhBeGlzUmlnaHR5QXhpc0JvdHRvbXlBeGlzVG9wcXVhZHJhbnRzcG9pbnRzcGFydGljaXBhbnRzbWVzc2FnZXNmcm9tdG90ZXh0YXJyb3dLaW5kc29saWRkb3R0ZWRzb2xpZC1vcGVuZG90dGVkLW9wZW5zbGljZXN2YWx1ZXNlY3Rpb25zbmFtZXRhc2tzZGVwc2R1cmF0aW9udmlzaWJpbGl0eXR5cGVJbmZvaXNNZXRob2RhdHRyaWJ1dGVzbWV0aG9kc3JlbFR5cGVhcnJvd0F0Y2xhc3Nlc3JlbGF0aW9uc2hpcHN4eUFueURpYWdyYW1HcmFwaGdyYXBoUGllcGllR2FudHRnYW50dFNlcXVlbmNlc2VxdWVuY2VDbGFzc2NsYXNzUXVhZHJhbnRxdWFkcmFudGZhbHNlLS0+Zmxvd2NoYXJ0bWlkID4gbGVucG9zaXRpb24gb3V0IG9mIGJvdW5kc8AELS0+IMDAATrAAQrIAAADIHwK2yAAAGgEAAIAAyB8IMgFAAEK0yAAAGgEAAMgfCDAAQrIAAADIHwgyAgAAQrIAAADIHwKyAAAAyA9IMgJAABGb3JtYXR0aW5nIGFyZ3VtZW50IG91dCBvZiByYW5nZcAELS0+IMDAATrAAQrIAAADIHwK2yAAAGgEAAIAAyB8IMgFAAEKyAAAByB8IC4uLgrbIAAAaAQABgADIHwgwAEKyAAAAyB8IMgIAAEKyAAAAyB8CsgAAAMgPSDICQAAwAQtLT4gwMABOsABCsgAAAMgfArIAgADIHwgyAQAAQrIAAADIHwgyAUAAQrIAAADIHwKyAAAAyA9IMgGAABwdWJsaWNwcml2YXRlcHJvdGVjdGVkaW50ZXJuYWw8fC0taW5oZXJpdGFuY2UqLS1jb21wb3NpdGlvbm8tLWFnZ3JlZ2F0aW9uLi58PmltcGxlbWVudHMuLj5kZXBlbmRlbmN5Li5ub25lPC0tZGlyZWN0ZWQtYXNzb2NpYXRpb24tLWFzc29jaWF0aW9uLS0+Pi0+Pi0+RU9JZmlsZWRpYWdyYW1rd3N0bXRzc3RtdHN0bXRfaW5uZXJjb21tZW50Y2hhaW5ub2RlZGVmbnJlZm5pZGNpcmNybmRkaWFtc3R4dGVkZ2VhcnJfbGJsYXJybG5fbGJsbG5sYmxsdHh0c3BubGZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXIAAAMEBwIJBQQKBwUHBAMFBAQDBAQEBwMGAgMEAgJ1dXV1dXV1dWJ0bnVmcnV1dXV1dXV1dXV1dXV1dXV1dQAAIgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDEyMzQ1Njc4OWFiY2RlZgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFZS0zMjQABQBlLTMyMwAFAGUtMzIyAAUAZS0zMjEABQBlLTMyMAAFAGUtMzE5AAUAZS0zMTgABQBlLTMxNwAFAGUtMzE2AAUAZS0zMTUABQBlLTMxNAAFAGUtMzEzAAUAZS0zMTIABQBlLTMxMQAFAGUtMzEwAAUAZS0zMDkABQBlLTMwOAAFAGUtMzA3AAUAZS0zMDYABQBlLTMwNQAFAGUtMzA0AAUAZS0zMDMABQBlLTMwMgAFAGUtMzAxAAUAZS0zMDAABQBlLTI5OQAFAGUtMjk4AAUAZS0yOTcABQBlLTI5NgAFAGUtMjk1AAUAZS0yOTQABQBlLTI5MwAFAGUtMjkyAAUAZS0yOTEABQBlLTI5MAAFAGUtMjg5AAUAZS0yODgABQBlLTI4NwAFAGUtMjg2AAUAZS0yODUABQBlLTI4NAAFAGUtMjgzAAUAZS0yODIABQBlLTI4MQAFAGUtMjgwAAUAZS0yNzkABQBlLTI3OAAFAGUtMjc3AAUAZS0yNzYABQBlLTI3NQAFAGUtMjc0AAUAZS0yNzMABQBlLTI3MgAFAGUtMjcxAAUAZS0yNzAABQBlLTI2OQAFAGUtMjY4AAUAZS0yNjcABQBlLTI2NgAFAGUtMjY1AAUAZS0yNjQABQBlLTI2MwAFAGUtMjYyAAUAZS0yNjEABQBlLTI2MAAFAGUtMjU5AAUAZS0yNTgABQBlLTI1NwAFAGUtMjU2AAUAZS0yNTUABQBlLTI1NAAFAGUtMjUzAAUAZS0yNTIABQBlLTI1MQAFAGUtMjUwAAUAZS0yNDkABQBlLTI0OAAFAGUtMjQ3AAUAZS0yNDYABQBlLTI0NQAFAGUtMjQ0AAUAZS0yNDMABQBlLTI0MgAFAGUtMjQxAAUAZS0yNDAABQBlLTIzOQAFAGUtMjM4AAUAZS0yMzcABQBlLTIzNgAFAGUtMjM1AAUAZS0yMzQABQBlLTIzMwAFAGUtMjMyAAUAZS0yMzEABQBlLTIzMAAFAGUtMjI5AAUAZS0yMjgABQBlLTIyNwAFAGUtMjI2AAUAZS0yMjUABQBlLTIyNAAFAGUtMjIzAAUAZS0yMjIABQBlLTIyMQAFAGUtMjIwAAUAZS0yMTkABQBlLTIxOAAFAGUtMjE3AAUAZS0yMTYABQBlLTIxNQAFAGUtMjE0AAUAZS0yMTMABQBlLTIxMgAFAGUtMjExAAUAZS0yMTAABQBlLTIwOQAFAGUtMjA4AAUAZS0yMDcABQBlLTIwNgAFAGUtMjA1AAUAZS0yMDQABQBlLTIwMwAFAGUtMjAyAAUAZS0yMDEABQBlLTIwMAAFAGUtMTk5AAUAZS0xOTgABQBlLTE5NwAFAGUtMTk2AAUAZS0xOTUABQBlLTE5NAAFAGUtMTkzAAUAZS0xOTIABQBlLTE5MQAFAGUtMTkwAAUAZS0xODkABQBlLTE4OAAFAGUtMTg3AAUAZS0xODYABQBlLTE4NQAFAGUtMTg0AAUAZS0xODMABQBlLTE4MgAFAGUtMTgxAAUAZS0xODAABQBlLTE3OQAFAGUtMTc4AAUAZS0xNzcABQBlLTE3NgAFAGUtMTc1AAUAZS0xNzQABQBlLTE3MwAFAGUtMTcyAAUAZS0xNzEABQBlLTE3MAAFAGUtMTY5AAUAZS0xNjgABQBlLTE2NwAFAGUtMTY2AAUAZS0xNjUABQBlLTE2NAAFAGUtMTYzAAUAZS0xNjIABQBlLTE2MQAFAGUtMTYwAAUAZS0xNTkABQBlLTE1OAAFAGUtMTU3AAUAZS0xNTYABQBlLTE1NQAFAGUtMTU0AAUAZS0xNTMABQBlLTE1MgAFAGUtMTUxAAUAZS0xNTAABQBlLTE0OQAFAGUtMTQ4AAUAZS0xNDcABQBlLTE0NgAFAGUtMTQ1AAUAZS0xNDQABQBlLTE0MwAFAGUtMTQyAAUAZS0xNDEABQBlLTE0MAAFAGUtMTM5AAUAZS0xMzgABQBlLTEzNwAFAGUtMTM2AAUAZS0xMzUABQBlLTEzNAAFAGUtMTMzAAUAZS0xMzIABQBlLTEzMQAFAGUtMTMwAAUAZS0xMjkABQBlLTEyOAAFAGUtMTI3AAUAZS0xMjYABQBlLTEyNQAFAGUtMTI0AAUAZS0xMjMABQBlLTEyMgAFAGUtMTIxAAUAZS0xMjAABQBlLTExOQAFAGUtMTE4AAUAZS0xMTcABQBlLTExNgAFAGUtMTE1AAUAZS0xMTQABQBlLTExMwAFAGUtMTEyAAUAZS0xMTEABQBlLTExMAAFAGUtMTA5AAUAZS0xMDgABQBlLTEwNwAFAGUtMTA2AAUAZS0xMDUABQBlLTEwNAAFAGUtMTAzAAUAZS0xMDIABQBlLTEwMQAFAGUtMTAwAAUAZS05OQAABABlLTk4AAAEAGUtOTcAAAQAZS05NgAABABlLTk1AAAEAGUtOTQAAAQAZS05MwAABABlLTkyAAAEAGUtOTEAAAQAZS05MAAABABlLTg5AAAEAGUtODgAAAQAZS04NwAABABlLTg2AAAEAGUtODUAAAQAZS04NAAABABlLTgzAAAEAGUtODIAAAQAZS04MQAABABlLTgwAAAEAGUtNzkAAAQAZS03OAAABABlLTc3AAAEAGUtNzYAAAQAZS03NQAABABlLTc0AAAEAGUtNzMAAAQAZS03MgAABABlLTcxAAAEAGUtNzAAAAQAZS02OQAABABlLTY4AAAEAGUtNjcAAAQAZS02NgAABABlLTY1AAAEAGUtNjQAAAQAZS02MwAABABlLTYyAAAEAGUtNjEAAAQAZS02MAAABABlLTU5AAAEAGUtNTgAAAQAZS01NwAABABlLTU2AAAEAGUtNTUAAAQAZS01NAAABABlLTUzAAAEAGUtNTIAAAQAZS01MQAABABlLTUwAAAEAGUtNDkAAAQAZS00OAAABABlLTQ3AAAEAGUtNDYAAAQAZS00NQAABABlLTQ0AAAEAGUtNDMAAAQAZS00MgAABABlLTQxAAAEAGUtNDAAAAQAZS0zOQAABABlLTM4AAAEAGUtMzcAAAQAZS0zNgAABABlLTM1AAAEAGUtMzQAAAQAZS0zMwAABABlLTMyAAAEAGUtMzEAAAQAZS0zMAAABABlLTI5AAAEAGUtMjgAAAQAZS0yNwAABABlLTI2AAAEAGUtMjUAAAQAZS0yNAAABABlLTIzAAAEAGUtMjIAAAQAZS0yMQAABABlLTIwAAAEAGUtMTkAAAQAZS0xOAAABABlLTE3AAAEAGUtMTYAAAQAZS0xNQAABABlLTE0AAAEAGUtMTMAAAQAZS0xMgAABABlLTExAAAEAGUtMTAAAAQAZS05AAAAAwBlLTgAAAADAGUtNwAAAAMAZS02AAAAAwBlLTUAAAADAGUtNAAAAAMAZS0zAAAAAwBlLTIAAAADAGUtMQAAAAMAZSswAAAAAwBlKzEAAAADAGUrMgAAAAMAZSszAAAAAwBlKzQAAAADAGUrNQAAAAMAZSs2AAAAAwBlKzcAAAADAGUrOAAAAAMAZSs5AAAAAwBlKzEwAAAEAGUrMTEAAAQAZSsxMgAABABlKzEzAAAEAGUrMTQAAAQAZSsxNQAABABlKzE2AAAEAGUrMTcAAAQAZSsxOAAABABlKzE5AAAEAGUrMjAAAAQAZSsyMQAABABlKzIyAAAEAGUrMjMAAAQAZSsyNAAABABlKzI1AAAEAGUrMjYAAAQAZSsyNwAABABlKzI4AAAEAGUrMjkAAAQAZSszMAAABABlKzMxAAAEAGUrMzIAAAQAZSszMwAABABlKzM0AAAEAGUrMzUAAAQAZSszNgAABABlKzM3AAAEAGUrMzgAAAQAZSszOQAABABlKzQwAAAEAGUrNDEAAAQAZSs0MgAABABlKzQzAAAEAGUrNDQAAAQAZSs0NQAABABlKzQ2AAAEAGUrNDcAAAQAZSs0OAAABABlKzQ5AAAEAGUrNTAAAAQAZSs1MQAABABlKzUyAAAEAGUrNTMAAAQAZSs1NAAABABlKzU1AAAEAGUrNTYAAAQAZSs1NwAABABlKzU4AAAEAGUrNTkAAAQAZSs2MAAABABlKzYxAAAEAGUrNjIAAAQAZSs2MwAABABlKzY0AAAEAGUrNjUAAAQAZSs2NgAABABlKzY3AAAEAGUrNjgAAAQAZSs2OQAABABlKzcwAAAEAGUrNzEAAAQAZSs3MgAABABlKzczAAAEAGUrNzQAAAQAZSs3NQAABABlKzc2AAAEAGUrNzcAAAQAZSs3OAAABABlKzc5AAAEAGUrODAAAAQAZSs4MQAABABlKzgyAAAEAGUrODMAAAQAZSs4NAAABABlKzg1AAAEAGUrODYAAAQAZSs4NwAABABlKzg4AAAEAGUrODkAAAQAZSs5MAAABABlKzkxAAAEAGUrOTIAAAQAZSs5MwAABABlKzk0AAAEAGUrOTUAAAQAZSs5NgAABABlKzk3AAAEAGUrOTgAAAQAZSs5OQAABABlKzEwMAAFAGUrMTAxAAUAZSsxMDIABQBlKzEwMwAFAGUrMTA0AAUAZSsxMDUABQBlKzEwNgAFAGUrMTA3AAUAZSsxMDgABQBlKzEwOQAFAGUrMTEwAAUAZSsxMTEABQBlKzExMgAFAGUrMTEzAAUAZSsxMTQABQBlKzExNQAFAGUrMTE2AAUAZSsxMTcABQBlKzExOAAFAGUrMTE5AAUAZSsxMjAABQBlKzEyMQAFAGUrMTIyAAUAZSsxMjMABQBlKzEyNAAFAGUrMTI1AAUAZSsxMjYABQBlKzEyNwAFAGUrMTI4AAUAZSsxMjkABQBlKzEzMAAFAGUrMTMxAAUAZSsxMzIABQBlKzEzMwAFAGUrMTM0AAUAZSsxMzUABQBlKzEzNgAFAGUrMTM3AAUAZSsxMzgABQBlKzEzOQAFAGUrMTQwAAUAZSsxNDEABQBlKzE0MgAFAGUrMTQzAAUAZSsxNDQABQBlKzE0NQAFAGUrMTQ2AAUAZSsxNDcABQBlKzE0OAAFAGUrMTQ5AAUAZSsxNTAABQBlKzE1MQAFAGUrMTUyAAUAZSsxNTMABQBlKzE1NAAFAGUrMTU1AAUAZSsxNTYABQBlKzE1NwAFAGUrMTU4AAUAZSsxNTkABQBlKzE2MAAFAGUrMTYxAAUAZSsxNjIABQBlKzE2MwAFAGUrMTY0AAUAZSsxNjUABQBlKzE2NgAFAGUrMTY3AAUAZSsxNjgABQBlKzE2OQAFAGUrMTcwAAUAZSsxNzEABQBlKzE3MgAFAGUrMTczAAUAZSsxNzQABQBlKzE3NQAFAGUrMTc2AAUAZSsxNzcABQBlKzE3OAAFAGUrMTc5AAUAZSsxODAABQBlKzE4MQAFAGUrMTgyAAUAZSsxODMABQBlKzE4NAAFAGUrMTg1AAUAZSsxODYABQBlKzE4NwAFAGUrMTg4AAUAZSsxODkABQBlKzE5MAAFAGUrMTkxAAUAZSsxOTIABQBlKzE5MwAFAGUrMTk0AAUAZSsxOTUABQBlKzE5NgAFAGUrMTk3AAUAZSsxOTgABQBlKzE5OQAFAGUrMjAwAAUAZSsyMDEABQBlKzIwMgAFAGUrMjAzAAUAZSsyMDQABQBlKzIwNQAFAGUrMjA2AAUAZSsyMDcABQBlKzIwOAAFAGUrMjA5AAUAZSsyMTAABQBlKzIxMQAFAGUrMjEyAAUAZSsyMTMABQBlKzIxNAAFAGUrMjE1AAUAZSsyMTYABQBlKzIxNwAFAGUrMjE4AAUAZSsyMTkABQBlKzIyMAAFAGUrMjIxAAUAZSsyMjIABQBlKzIyMwAFAGUrMjI0AAUAZSsyMjUABQBlKzIyNgAFAGUrMjI3AAUAZSsyMjgABQBlKzIyOQAFAGUrMjMwAAUAZSsyMzEABQBlKzIzMgAFAGUrMjMzAAUAZSsyMzQABQBlKzIzNQAFAGUrMjM2AAUAZSsyMzcABQBlKzIzOAAFAGUrMjM5AAUAZSsyNDAABQBlKzI0MQAFAGUrMjQyAAUAZSsyNDMABQBlKzI0NAAFAGUrMjQ1AAUAZSsyNDYABQBlKzI0NwAFAGUrMjQ4AAUAZSsyNDkABQBlKzI1MAAFAGUrMjUxAAUAZSsyNTIABQBlKzI1MwAFAGUrMjU0AAUAZSsyNTUABQBlKzI1NgAFAGUrMjU3AAUAZSsyNTgABQBlKzI1OQAFAGUrMjYwAAUAZSsyNjEABQBlKzI2MgAFAGUrMjYzAAUAZSsyNjQABQBlKzI2NQAFAGUrMjY2AAUAZSsyNjcABQBlKzI2OAAFAGUrMjY5AAUAZSsyNzAABQBlKzI3MQAFAGUrMjcyAAUAZSsyNzMABQBlKzI3NAAFAGUrMjc1AAUAZSsyNzYABQBlKzI3NwAFAGUrMjc4AAUAZSsyNzkABQBlKzI4MAAFAGUrMjgxAAUAZSsyODIABQBlKzI4MwAFAGUrMjg0AAUAZSsyODUABQBlKzI4NgAFAGUrMjg3AAUAZSsyODgABQBlKzI4OQAFAGUrMjkwAAUAZSsyOTEABQBlKzI5MgAFAGUrMjkzAAUAZSsyOTQABQBlKzI5NQAFAGUrMjk2AAUAZSsyOTcABQBlKzI5OAAFAGUrMjk5AAUA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G8TH2/PvTSJz6selAAhskCK1uRLva+HqD+U5zwAKhzRrImjXdePM8ikvhIFAZtQAgxWh5lMcgG/0OuWh0H8JweNaSWBoI2CLsYleysTfS7GcsVs4Qiw47h0s9vy1157dA55yRqkb47SS2xme0UaDasKiB2wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOKQjeKQimEgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90ZmlsZSBuYW1lIGNvbnRhaW5lZCBhbiB1bmV4cGVjdGVkIE5VTCBieXRlbWFpbjx1bm5hbWVkPm5vdGU6IHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT0xYCBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBkaXNwbGF5IGEgYmFja3RyYWNlCgAAAFz26V/cAva58cFwbPJhwSQPJ2bxohUEikyn8/12At9xZmF0YWwgcnVudGltZSBlcnJvcjogcndsb2NrIGxvY2tlZCBmb3Igd3JpdGluZywgYWJvcnRpbmcKcndsb2NrIG92ZXJmbG93ZWQgcmVhZCBsb2Nrc1JVU1RfQkFDS1RSQUNFY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXhhZHZhbmNpbmcgSW9TbGljZSBiZXlvbmQgaXRzIGxlbmd0aGFkdmFuY2luZyBpbyBzbGljZXMgYmV5b25kIHRoZWlyIGxlbmd0aABCb3g8ZHluIEFueT50aHJlYWQgY2F1c2VkIG5vbi11bndpbmRpbmcgcGFuaWMuIGFib3J0aW5nLgpzdGFjayBiYWNrdHJhY2U6Cm5vdGU6IFNvbWUgZGV0YWlscyBhcmUgb21pdHRlZCwgcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPWZ1bGxgIGZvciBhIHZlcmJvc2UgYmFja3RyYWNlLgpmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyc3RyZXJyb3JfciBmYWlsdXJlZmFpbGVkIHRvIGdlbmVyYXRlIHVuaXF1ZSB0aHJlYWQgSUQ6IGJpdHNwYWNlIGV4aGF1c3RlZHJ3bG9jayBoYXMgbm90IGJlZW4gbG9ja2VkIGZvciByZWFkaW5nIgEICSsNKysrHCsrBgIDHisrGgwrGwQrKycjFCkrDxIoICsrIQorBSgrKwArKysmKysYJAcOECsrJCsrKysBCysrKysRGSsTFh0fSGFzaCB0YWJsZSBjYXBhY2l0eSBvdmVyZmxvd1N1Y2Nlc3MASWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgdW5yZWFjaGFibGUAQWRkcmVzcyBpbiB1c2UAQnJva2VuIHBpcGUASS9PIGVycm9yAE5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3MATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UATm90IGEgc29ja2V0AERlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQATWVzc2FnZSB0b28gbGFyZ2UAUHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0AFByb3RvY29sIG5vdCBhdmFpbGFibGUAUHJvdG9jb2wgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAE9wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzAE9wZXJhdGlvbiBpbiBwcm9ncmVzcwBTdGFsZSBmaWxlIGhhbmRsZQBRdW90YSBleGNlZWRlZABNdWx0aWhvcCBhdHRlbXB0ZWQAQ2FwYWJpbGl0aWVzIGluc3VmZmljaWVudAAAAAAAAAAAAAAAAAB1Ak4A1gHiBLkEGAGOBe0CFgTyAJcDAQM4Ba8BggFPAy8EHgDUBaIAEgMeA8IB3gMIAKwFAAFkAvEBZQU0AowCzwItA0wE4wWfAvgEHAUIBbECSwUVAngAUgI8A/ED5ADDA30EzACqA3kFJAJuAW0DIgSrBEQA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");
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
