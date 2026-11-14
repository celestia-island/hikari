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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABngEXYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gBH9/f38Bf2AFf39/f38Bf2AHf39/f39/fwBgBn9/f39/fwBgBH5+f38BfmACfH8Bf2AIf39/f39/f38AYAN/fn4AYAF/AX5gBX9+fn5+AAKdCBYgd2FzaTpyYW5kb20vaW5zZWN1cmUtc2VlZEAwLjIuMTINaW5zZWN1cmUtc2VlZAAGE3dhc2k6aW8vZXJyb3JAMC4yLjAUW3Jlc291cmNlLWRyb3BdZXJyb3IABhJ3YXNpOmlvL3BvbGxAMC4yLjAXW3Jlc291cmNlLWRyb3BdcG9sbGFibGUABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAYVd2FzaTppby9zdHJlYW1zQDAuMi4wHFtyZXNvdXJjZS1kcm9wXW91dHB1dC1zdHJlYW0ABh13YXNpOmNsaS90ZXJtaW5hbC1pbnB1dEAwLjIuMB1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAGHndhc2k6Y2xpL3Rlcm1pbmFsLW91dHB1dEAwLjIuMB5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQABhp3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMA9nZXQtZW52aXJvbm1lbnQABhN3YXNpOmNsaS9leGl0QDAuMi4wBGV4aXQABhJ3YXNpOmlvL3BvbGxAMC4yLjAWW21ldGhvZF1wb2xsYWJsZS5ibG9jawAGEndhc2k6aW8vcG9sbEAwLjIuMARwb2xsAAcVd2FzaTppby9zdHJlYW1zQDAuMi4wIVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQABFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUAAhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAkW21ldGhvZF1vdXRwdXQtc3RyZWFtLmJsb2NraW5nLWZsdXNoAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wH1ttZXRob2Rdb3V0cHV0LXN0cmVhbS5z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AUHMAGoQpoCAgAALIAFBhAFqIQ0gASgCUCALQQN0aiIOIAM2AgQgDiADNgIAIAEgC0EBajYCVEEAIQsCQCABKAKMASIDQXxLDQAgA0EDaiIPIAEoAogBSw0AIA0oAgAgA2oiDi8AAEGt2gBzIA5BAmotAABBLXNyQf//A3ENACABIA82AowBQQEhCwsCQCABLQCAAUEBRw0AEISBgIAAQQNBARCBgYCAACIORQ0CIA5BLToAAiAOQa3aADsAACACQQM2AjwgAiAONgI4IAJCgICAgDA3AjAgASADIAJBMGogCxCggICAAAsCQAJAAkAgC0UNACABQQEQjoGAgABFDQAgASgCGCEOIAIgDSgCCDYCSCACIA0pAgA3A0AgASgCPCEDAkAgASgCVCILIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgC0EBajYCVCABKAJQIAtBA3RqIgsgAzYCBCALIAM2AgACQCABQQEQjoGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQjoGAgABFDQACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQ0gAiABKAKMATYCOCACIAEpAoQBNwMwIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsg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96DAgABqNgIcIAIgAkEYajYCPCACQcAAaiACQRxqELqAgIAAIAIoAkAhAyACLQBEIgRB/wFGDQogAiAEOgBcIAIgAzYCWCACQdgAaiOBgICAAEHPoMCAAGpBBSABQRBqELyAgIAAIgMNCiACKAJYIgYoAgAhAyABKAIMIQUgASgCCCEEAkAgAi0AXEEBRg0AAkAgAygCACADKAIIIgFHDQAgAyABQQFBAUEBEJqAgIAAIAMoAgghAQsgAyABQQFqNgIIIAMoAgQgAWpBLDoAACAGKAIAIQMLIAMjgYCAgABB1KDAgABqQQYQu4CAgAAiAw0KAkAgBigCACIDKAIAIAMoAggiAUcNACADIAFBAUEBQQEQmoCAgAAgAygCCCEBCyADIAFBAWo2AgggAygCBCABakE6OgAAAkAgBigCACIBKAIAIAEoAggiB0cNACABIAdBAUEBQQEQmoCAgAAgASgCCCEHCyABIAdBAWoiAzYCCCABKAIEIAdqQdsAOgAAAkACQAJAIAUNACABKAIAIANGDQEMAgsCQCABKAIAIANHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pB2wA6AAAgASAEKAIEIAQoAggQu4CAgAAiAw0MIAQrAxAhCgJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBaiIJNgIIIAEoAgQgA2pBLDoAAAJAAkAgCr1CAYZC/////////29WDQACQAJAAkAgCiACQcAAahCFgYCAACIJIAJBwABqayIDIAEoAgAgASgCCCIHa0sNACAJIAJBwABqRw0BDAILIAEgByADQQFBARCagICAACABKAIIIQcLIANFDQAgASgCBCAHaiACQcAAaiAD/AoAAAsgASAHIANqIgc2AggMAQsCQCABKAIAIAlrQQNLDQAgASAJQQRBAUEBEJqAgIAAIAEoAgghCQsgASAJQQRqIgc2AgggASgCBCAJakHu6rHjBjYAAAsCQCABKAIAIAdHDQAgASAHQQFBAUEBEJqAgIAAIAEoAgghBwsgASAHQQFqIgM2AgggASgCBCAHakHdADoAAAJAIAVBAUYNACAFQRhsQWhqIQkgBEEoaiEEA0ACQCABKAIAIANHDQAgASADQQFBAUEBEJqAgIAAIAEo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ASAEQQFqIgM2AgggASgCBCAEakEsOgAACwJAIAEoAgAgA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakH7ADoAACAHIAVqIgRBCGooAgAhCSAEQQRqKAIAIQggASOBgICAAEGdoMCAAGpBBBC7gICAACIDDQkCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAIAEgCCAJELuAgIAAIgMNCSAEQRRqKAIAIQkgBEEQaigCACEIAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBLDoAACABI4GAgIAAQaGgwIAAakECELuAgIAAIgMNCQJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQTo6AAAgASAIIAkQu4CAgAAiAw0JIARBIGooAgAhCSAEQRxqKAIAIQgCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakEsOgAAIAEjgYCAgABBo6DAgABqQQQQu4CAgAAiAw0JAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAACABIAggCRC7gICAACIDDQkgBEEkai0AACEEAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBLDoAACABI4GAgIAAQaegwIAAakEKELuAgIAAIgMNCQJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQTo6AAACQAJAAkACQAJAIAQOBAABAgMACyABI4GAgIAAQbGgwIAAakEFELuAgIAAIQMMAwsgASOBgICAAEG2oMCAAGpBBhC7gICAACEDDAILIAEjgYCAgABBvKDAgABqQQkQu4CAgAAhAwwBCyABI4GAgIAAQcWgwIAAakEKELuAgIAAIQMLIAMNCQJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBaiIENgIIIAEoAgQgA2pB/QA6AABBACEDIA0gBUEoaiIFRw0ACyABKAIAIARHDQQMAwtBAUGAARCzgoCAAAALIAQoAgAgBkYNBAwFCyABKAIAIARHDQELIAEgBEEBQQFBARCagICAACABKAIIIQQLIAEoAgQgBGpB3QA6AAAgASAEQQFqNgIIAkAgBigCACIDKAIAIAMoAggiAUcNACADIAFBAUEBQQEQmoCAgAAgAygCCCEBCyADIAFBAWo2AgggAygCBCABakH9ADoAAAtBACEDDAILIAQgBkEBQQFBARCagICAACAEKAIIIQYLIAQoAgQgBmpB3QA6AAAgBCAGQQFqNgIIIAJBwABqIAEoAiggASgCLBC+gICAACIDDQAgAigCQCgCACACLQBEEL+AgIAAIQMLAkACQCADRQ0AIABBfzYCACAAIAM2AgQgAigCDCIDRQ0BIAIoAhAgA0EBEIKBgIAADAELIAAgAigCFDYCCCAAIAIpAgw3AgALIAJB4ABqJICAgIAAC/IBAQR/AkAgASgCICICKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQfsAOgAAIAEoAhwhBCABKAIYIQVB/wEhAwJAIAIoAgAgASgCECABKAIUELuAgIAAIgENAAJAIAIoAgAiASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAAEF/QQIgAigCACAFIAQQu4CAgAAiARshAyABIAIgARshAQsgACADOgAEIAAgATYCAAvpBAEGfwJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCagICAACAAKAIIIQMLIAAgA0EBaiIENgIIIAAoAgQgA2pBIjoAAAJAIAJFDQADQCACIQVBACEDAkADQCABIANqIgYtAAAiByOFgICAAGotAAAiAg0BIAUgA0EBaiIDRw0ACyAFIQIMAgsCQCADRQ0AAkAgAyAAKAIAIARrTQ0AIAAgBCADQQFBARCagICAACAAKAIIIQQLAkAgA0UNACAAKAIEIARqIAEgA/wKAAALIAAgBCADaiIE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QQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQTBqIAEQsoCAgAAgAigCNCEBAkAgAigCMCIFQQFHDQAgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAVBAXENAANAAkACQCABQQEQjoGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCIFQQFHDQAgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAFQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJoNgKMASABIAIpA2A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBIGogARDTgICAACACKAIkIQEgAigCIEEBcQ0AIAFBARCOgYCAAEUNACABKAIYIQggAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkACQCABQQEQjoGAgABFDQAgAkEYaiABELKAgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQjoGAgABFDQACQAJAIAFBARCOgYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgBUEBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAVBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAmg2AowBIAEgAikDYDcChAECQCAIIAEoAhhLDQAgASAINgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAiABENSAgIAAIAIoAgQhASACKAIAIQMLAkAgA0EBRw0AIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIAcgASgCGEsNACABIAc2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFHDQAgASACKAJINgKMASABIAIpA0A3AoQBAkAgBCABKAIYSw0AIAEgBDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAAIAM2AgAgACABNgIEIAJBgAFqJICAgIAAC4oJAQt/I4CAgIAAQSBrIgIkgICAgABBASEDAkAgAUEBEI6BgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKIAJBGGogARD4gICAACACKAIcIQECQAJAAkAgAigCGEEBRw0AIAJBEGogARCkgICAACACKAIUIQEgAigCEEEBRw0AIAJBCGogARCxgICAACACKAIMIQEgAigCCEEBcQ0BC0EAIQsMAQsgAiABEJ6AgIAAIAIoAgQhASACKAIAIQsLQQEhAyABLQCUASEMAkACQAJAAkACQAJAIAtBAUcNACAMQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiDCABKAIkIgNqIgYgCE0NACAGIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgDEsNAiABIAQ2AjAMAgsgDEH/AXFBAUcNAyABLQCVAUUNBAJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiDGoiBiAITQ0AIAYgCGtBAUYNBwsCQCAFIAxLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQUgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakETOgAAIAEgA0EBajYCMCABLQCUASEMDAMLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakETOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQRNBACAKIAEoAnwgCUsbEKKAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDEH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQwCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgDDYCECADQQA2AgggAyAHNgIEIANBgSY7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEG0vsKAAGoQ0IKAgAAACyOBgICAACIBQbqdwIAAakEoIAFBxL7CgABqEMKCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakETQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQSBqJICAgIAAC5gQAQ5/I4CAgIAAQeAAayICJICAgIAAQQEhAwJAIAFBARCOgYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQCABQQEQjoGAgABFDQAgASgCGCEMIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEoaiABEPaAgIAAIAIoAiwhAQJAIAIoAihBAXENACABQQEQjoGAgABFDQAgASgCGCEOIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEI6BgIAARQ0AIAJBIGogARCygICAACACKAIkIQECQCACKAIgQQFxDQAgAUEBEI6BgIAARQ0AAkACQCABQQEQjoGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQjoGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEg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AEgNCAJAIAYNAEEBIQwMCwsgAygCICENEISBgIAAQQEhCyAGQQEQgYGAgAAiDEUNCCAGRQ0KIAwgDSAG/AoAAAwKCyADKAJAIQEQhIGAgABBASECIAhBARCBgYCAACIGDQEgCCEJCyACIAkQs4KAgAAACwJAIAhFDQAgBiABIAj8CgAACyAGIQkLIAghBCAHQQBMDQoMBQsgAygCMCEBEISBgIAAQQEhAiAIQQEQgYGAgAAiBg0BIAghCgsgAiAKELOCgIAAAAsCQCAIRQ0AIAYgASAI/AoAAAsgBiEKCyAIIQQgB0EASg0BDAYLIAsgBhCzgoCAAAALIAUgB0EBEIKBgIAAIAghBAwECwJAAkACQCAEIAJBAWoiAk0NACABIAJqLAAAQb9/TA0BCyADQRhqIAEgAmogBCACaxCXgICAACADQZABaiADKAIYIAMoAhwQ7oKAgAAgAy0AkAENASAGRQ0CIAMrA5gBIQ4CQCADKAJkIgEgAygCXEcNACADQdwAahDggICAAAsgAygCYCABQRhsaiICIA45AxAgAiAGNgIIIAIgDDYCBCACIAY2AgAgAyABQQFqNgJkDAILIAEgBCACIAQjgYCAgABBqMLCgABqENyCgIAAAAsgBkUNACAMIAZBARCCgYCAAAsgA0EQaiADQegAahDngICAACADKAIUIQIgAygCECIBDQALIAUhBiAHIQQMAwsgBSEGIAchBAsgA0EIaiADQegAahDngICAACADKAIMIQIgAygCCCIBDQALCwJAAkAgAygCZEUNACAAIAMoAmQ2AgggACADKQJcNwIAIAAgCDYCFCAAIAY2AhAgACAENgIMDAELIABBfzYCAAJAIAMoAlwiAkUNACADKAJgIAJBGGxBCBCCgYCAAAsgBEEBSA0AIAYgBEEBEIKBgIAACyADQaABaiSAgICAAAuhFgEWfyOAgICAAEHwAmsiAySAgICAACADQQA2ApwBIANCgICAgMAANwKUASADQQA7AcQBIAMgAjYCwAEgA0EANgK8ASADQQE6ALgBIANBCjYCtAEgAyACNgKwASADQQA2AqwBIAMgAjYCqAEgAyABNgKkASADQQo2AqABIANBiAFqIANBoAFqEOeAgIAAAkACQCADKAKIASIBDQBBfyEEDAELIANB8AFqQQxqIQUgAygCjAEhAkF/IQQDQAJAAkAgAg0AQQAhAgwBCyABIAJBf2oiBmotAABBCkcNACACQX5qIQICQAJAIAYNAEEAIQcMAQsgAUEAIAEgAmotAABBDUYbIQcLIAIgBiAHGyECIAcgASAHGyEBCyADQYABaiABIAIQl4CAgAACQAJAIAMoAoQBIgJFDQAgAygCgAEhASACQQVJDQECQAJAAkACQAJAAkACQAJAAkACQAJAAkAgASgAAEHnwrmjB3MgAUEEaiIGLQAAQfQAc3JFDQAgAkEFRg0NIAEoAABB9NLR4wZzIAYvAABB5cAAc3JFDQEgAkEISQ0NIAEpAABC88qNo5ftm7cgUg0NIANB+ABqIAFBCGogAkF4ahCXgICAAEEAIQEgAygCfCICQQBIDQMgAg0CQQEhCAwFCyADQegAaiABQQVqIAJBe2oQl4CAgAAgAygCbCICQQZJDQsgAygCaCIBKAAAQfTS0eMGcyABQQRqLwAAQeXAAHNyDQsgA0HgAGogAUEGaiACQXpqEJeAgIAAQQAhAiADKAJkIglBAEgNByAJDQZBASEKDAoLIANB8ABqIAFBBmogAkF6ahCXgICAAEEAIQICQCADKAJ0IglBAEgNAAJAIAkNAEEBIQsMCgsgAygCcCEBEISBgIAAQQEhAiAJQQEQgYGAgAAiCw0FIAkhCwsgAiALELOCgIAAAAsgAygCeCEGEISBgIAAQQEhASACQQEQgYGAgAAiCA0BIAIhCAsgASAIELOCgIAAAAsgAkUNACAIIAYgAvwKAAALAkAgAygCnAEiBiADKAKUAUcNACADQZQBahDegICAAAsgAygCmAEgBkEYbGoiAUEANgIUIAFCgICAgMAANwIMIAEgAjYCCCABIAg2AgQgASACNgIAIAMgBkEBajYCnAEMBgsgCUUNAyALIAEgCfwKAAAMAwsgAygCYCEBEISBgIAAQQEhAiAJQQEQgYGAgAAiCg0BIAkhCgsgAiAKELOCgIAAAAsgCUUNASAKIAEgCfwKAAAMAQsCQCAEQQFIDQAgDCAEQQEQgoGAgAALIAshDCAJIQQMAQsCQCAEQQFIDQAgDCAEQQEQgoGAgAALIAohDCAJIQQLIANBCGogA0GgAWoQ54CAgAAgAygCDCECIAMoAggiAUUNAgwBCyADQQE7AewBIAMgAjYC6AEgA0EANgLkASADQQE6AOABIANBOjYC3AEgAyACNgLYASADQQA2AtQBIAMgAjYC0AEgAyABNgLMASADQTo2AsgBIANB2ABqIANByAFqEOiAgIAAAkAgAygCWCICRQ0AIANB0ABqIAIgAygCXBCXgICAAEEAIQECQAJAIAMoAlQiAkEASA0AIAJFDQIgAygCUCEHEISBgIAAQQEhASACQQEQgYGAgAAiBg0BCyABIAIQs4KAgAAACwJAIAJFDQAgBiAHIAL8CgAACyADQcgAaiADQcgBahDogICAACADQcAAaiADKAJIIgFBASABGyADKAJMQQAgARsQl4CAgAAgAygCQCEHIAMoAkQhASADIAI2AvgBIAMgBjYC9AEgAyACNgLwASADQX82ApQCIANCgICAgHA3AoQCIANCgICAgMAANwL8ASADQQE7AcQCIAMgATYCwAIgA0EANgK8AiADQQE6ALgCIANBLDYCtAIgAyABNgKwAiADQQA2AqwCIAMgATYCqAIgAyAHNgKkAiADQSw2AqACA0AgA0E4aiADQaACahDogICAAAJAAkACQCADKAI4IgJFDQAgA0EwaiACIAMoAjwQl4CAgAAgAygCNCICRQ0DIAJBA0kNAyADKAIwIgEvAABB6cgBcyABQQJqLQAAQT1zckH//wNxRQ0CIAJBA0YNAyABKAAAQeTqyesDRg0BIAJBBkkNAyABKAAAQeHM0asGcyABQQRqLwAAQfLAAHNyDQMgA0EBOwHsAiADQQA2AuQCIANBAToA4AIgA0EgNgLcAiADQQA2AtQCIANBIDYCyAIgAyACQXpqIgI2AugCIAMgAjYC2AIgAyACNgLQAiADIAFBBmo2AswCIANBKGogA0HIAmoQ6ICAgAAgAygCKCICRQ0DIAMoAiwhAQNAIANBIGogAiABEJeAgIAAAkAgAygCJCICRQ0AQQAhAQJAAkAgAkEASA0AIAMoAiAhDRCEgYCAAEEBIQEgAkEBEIGBgIAAIg4NASACIQ4LIAEgDhCzgoCAAAALAkAgAkUNACAOIA0gAvwKAAALAkAgAygChAIiASADKAL8AUcNACAFEOaBgIAACyADKAKAAiABQQxsaiINIAI2AgggDSAONgIEIA0gAjYCACADIAFBAWo2AoQCCyADQRhqIANByAJqEOiAgIAAIAMoAhwhASADKAIYIgJFDQQMAAsLIAMoAvABIgZBf0YNAyADKAL0ASEPIAMoAvwBIQcgAygCgAIhECADKAKEAiEBIAMoAogCIQ4gAygCjAIhESADKAKUAiENIAMoApgCIRICQCADKAKcASICDQACQCAGRQ0AIA8gBkEBEIKBgIAACwJAIA5BAUgNACARIA5BARCCgYCAAAsCQCABRQ0AIBAhAgNAAkAgAigCACIGRQ0AIAJBBGooAgAgBkEBEIKBgIAACyACQQxqIQIgAUF/aiIBDQALCwJAIAdFDQAgECAHQQxsQQQQgoGAgAALIA1BAUgNBCASIA1BARCCgYCAAAwECyADKAL4ASETIAMoApACIRQgAygCnAIhFQJAIAMoApgBIAJBGGxqIgJBfGoiFigCACIXIAJBdGoiGCgCAEcNACAYEN+AgIAACyACQXhqKAIAIBdBMGxqIgIgFTYCLCACIBI2AiggAiANNgIkIAIgFDYCICACIBE2AhwgAiAONgIYIAIgATYCFCACIBA2AhAgAiAHNgIMIAIgEzYCCCACIA82AgQgAiAGNgIAIBYgF0EBajYCAAwDC0EAIQ0CQAJAAkAgAkF8aiICQQBIDQACQCACDQBBASEHDAMLEISBgIAAQQEhDSACQQEQgYGAgAAiBw0BIAIhBwsgDSAHELOCgIAAAAsgAkUNACAHIAFBBGogAvwKAAALAkAgAygClAIiAUEBSA0AIAMoApgCIAFBARCCgYCAAAsgAyACNgKcAiADIAc2ApgCIAMgAjYClAIMAQtBACENAkACQAJAIAJBfWoiAkEASA0AAkAgAg0AQQEhBgwDCxCEgYCAAEEBIQ0gAkEBEIGBgIAAIgYNASACIQYLIA0gBhCzgoCAAAALIAJFDQAgBiABQQNqIAL8CgAACwJAIAMoAogCIgFBAUgNACADKAKMAiABQQEQgoGAgAALIAMgAjYCkAIgAyAGNgKMAiADIAI2AogCDAALCyADQRBqIANBoAFqEOeAgIAAIAMoAhQhAiADKAIQIgENAAsLAkACQCADKAKcAUUNACAAIAMoApwBNgIIIAAgAykClAE3AgAgACAJNgIUIAAgDDYCECAAIAQ2AgwMAQsgAEF/NgIAIANBlAFqEMCAgIAAIARBAUgNACAMIARBARCCgYCAAAsgA0HwAmokgICAgAALpwoBAX8jgICAgABBgAFrIgMkgICAgAAgAyABIAIQl4CAgAACQAJAAkACQAJAAkAgAygCBCIBQQNJDQAgAygCACICLwAAQfDSAXMgAkECai0AAEHlAHNyQf//A3FFDQQgAUEFSQ0AIAIoAABB58K5owdzIAJBBGotAABB9ABzckUNAwJAIAFBD0kNACACKQAAQvPKxavXzNux5QCFIAJBB2opAABC5Yili/bM3LDtAIWEUA0DCwJAIAIoAABB5+SFgwdzIAJBBGotAABB6ABzckUNACABQQlJDQEgAikAAELm2L27t4zasPIAhSACQQhqMQAAQvQAhYRCAFINAQsgA0EMaiACIAEQ64CAgAAgAygCDEF/Rw0BAkAgAygCECICRQ0AIAMoAhQgAkEBEIKBgIAACyAAQX82AgAMBQsgAEF/NgIADAQLIAMgAygCPDYCcCADIAMpAjQ3A2ggAyADKQIsNwNgIAMgAykCJDcDWCADIAMpAhw3A1AgAyADKQIUNwNIIAMgAykCDDcDQCADQQxqIANBwABqELmAgIAAIAMoAhAhAgJAAkAgAygCDCIBQX9GDQAgACADKAIUNgIIIAAgAjYCBCAAIAE2AgAMAQsgAEF/NgIAAkACQAJAIAIoAgAOAgABAgsgAigCCCIARQ0BIAIoAgQgAEEBEIKBgIAADAELIAItAARBA0cNACACQQhqEO+CgIAACyACQRRBBBCCgYCAAAsgA0HAAGoQxoCAgAAMAwsgA0EMaiACIAEQ8YCAgAACQCADKAIMQX9GDQAgAyADKQIcNwJUIAMgAykCFDcCTCADIAMpAgw3AkQgA0GCgICAeDYCQCADQfQAaiADQcAAahC5gICAACADKAJ4IQICQAJAIAMoAnQiAUF/Rg0AIAAgAygCfDYCCCAAIAI2AgQgACABNgIADAELIABBfzYCAAJAAkACQCACKAIADgIAAQILIAIoAggiAEUNASACKAIEIABBARCCgYCAAAwBCyACLQAEQQNHDQAgAkEIahDvgoCAAAsgAkEUQQQQgoGAgAALIANBwABqEMaAgIAADAMLIABBfzYCAAwCCyADQQxqIAIgARDvgICAAAJAIAMoAgxBf0YNACADIAMpAhw3AlQgAyADKQIUNwJMIAMgAykCDDcCRCADQYGAgIB4NgJAIANB9ABqIANBwABqELmAgIAAIAMoAnghAgJAAkAgAygCdCIBQX9GDQAgACADKAJ8NgIIIAAgAjYCBCAAIAE2AgAMAQsgAEF/NgIAAkACQAJAIAIoAgAOAgABAgsgAigCCCIARQ0BIAIoAgQgAEEBEIKBgIAADAELIAItAARBA0cNACACQQhqEO+CgIAACyACQRRBBBCCgYCAAAsgA0HAAGoQxoCAgAAMAgsgAEF/NgIADAELIANBDGogAiABEO6AgIAAAkAgAygCDEF/Rg0AIAMgAykCHDcCVCADIAMpAhQ3AkwgAyADKQIMNwJEIANBgICAgHg2AkAgA0H0AGogA0HAAGoQuYCAgAAgAygCeCECAkACQCADKAJ0IgFBf0YNACAAIAMoAnw2AgggACACNgIEIAAgATYCAAwBCyAAQX82AgACQAJAAkAgAigCAA4CAAECCyACKAIIIgBFDQEgAigCBCAAQQEQgoGAgAAMAQsgAi0ABEEDRw0AIAJBCGoQ74KAgAALIAJBFEEEEIKBgIAACyADQcAAahDGgICAAAwBCyAAQX82AgALIANBgAFqJICAgIAAC88gAxV/AX4FfyOAgICAAEHQAmsiAySAgICAACADQQA2AmQgA0KAgICAwAA3AlwgA0EANgJwIANCgICAgMAANwJoIANBADsBmAEgAyACNgKUASADQQA2ApABIANBAToAjAEgA0EKNgKIASADIAI2AoQBIANBADYCgAEgAyACNgJ8IAMgATYCeCADQQo2AnQgA0HQAGogA0H0AGoQ54CAgAACQCADKAJQIgFFDQAgA0GAAmpBDGohBCADQZwBakEIaiEFIAMoAlQhAgJAA0ACQAJAIAINAEEAIQIMAQsgASACQX9qIgZqLQAAQQpHDQAgAkF+aiECAkACQCAGDQBBACEHDAELIAFBACABIAJqLQAAQQ1GGyEHCyACIAYgBxshAiAHIAEgBxshAQsgA0HIAGogASACEJeAgIAAAkACQAJAAkAgAygCTCIIRQ0AIAMoAkghCQJAAkACQAJAIAhBD0kNACAJKQAAQvPKxavXzNux5QCFIAlBB2opAABC5Yili/bM3LDtAIWEUEUNAQwECyAIQQxJDQELIAkpAABC8MLJo5ft2LTwAIUgCUEIajUAAELh3NGDAoWEUA0BCyADQQM6ANABIANBAzYCzAEgA0ECOgDEASADQQI2AsABIANBAToAuAEgA0EENgK0AUEAIQogA0EAOgCsASADQQM2AqgBIANCgICAgMAANwKcASADI4GAgIAAIgJBq6HAgABqNgLIASADIAJB7KPAgABqNgK8ASADIAJB6KPAgABqNgKwASADIAJB5aPAgABqNgKkAQNAIAUgCkEMbGoiAi0ACCILQf8BRg0EIApBAWohCiADQYACaiAJIAggAigCACACKAIEIgwQ2oKAgAACQAJAAkACQAJAAkAgAygCgAINACADLQCOAg0CIAMtAIwCIQEgAygCtAIhAiADKAKwAiEGAkAgAygChAIiDUUNAAJAIA0gAkkNACANIAJGDQEMDwsgBiANaiwAAEFASA0OCyANIAJGDQECQAJAIAYgDWoiDiwAACIHQX9KDQAgDi0AAUE/cSEPIAdBH3EhEAJAIAdBYE8NACAQQQZ0IA9yIQcMAgsgD0EGdCAOLQACQT9xciEPAkAgB0FwTw0AIA8gEEEMdHIhBwwCCyAPQQZ0IA4tAANBP3FyIBBBEnRBgIDwAHFyIQcMAQsgB0H/AXEhBwsgAUEBcQ0EAkACQCAHQYABTw0AQQEhAQwBCwJAIAdBgBBPDQBBAiEBDAELQQNBBCAHQYCABEkbIQELAkAgASANaiIBRQ0AAkAgASACSQ0AIAEgAkYNAQwNCyAGIAFqLAAAQUBIDQwLIAIhDSABIAJGDQQgBiABaiwAACICQX9KDQMgAkFgSRoMAwsgAygCvAIiBkF/aiERIAMoArgCIQ8gAygCtAIhEiADKAKwAiEQAkACQCADKAKkAiIHQX9GDQAgAygCnAIiDSARaiICIBJPDQMgAygCkAIiE0F/aiEUQQEgE2shFSAGIAMoApgCIhZrIRcgAykDiAIhGANAAkACQAJAIBggECACajEAAIinQQFxDQAgDSAGaiENDAELAkACQCAHIBMgByATSxsiAiAGTw0AIAIgBiACIAZLGyACayEOIA8gAmohASANIAJqIQIDQCABLQAAIBAgAmotAABHDQIgAUEBaiEBIAJBAWohAiAOQX9qIg4NAAsLIAcgE08NCSAQIA1qIQ4gFCECA0AgAiAGTw0GAkAgDyACai0AACAOIAJqLQAARw0AIAcgAk8hASACQX9qIQIgAQ0LDAELCyANIBZqIQ0gFyEHDAILIBUgAmohDQtBACEHCyANIBFqIgIgEkkNAAwECwsgAygCnAIiDSARaiICIBJPDQIgAygCkAIiByAGIAcgBksbIRYgD0F/aiETIBBBf2ohFSAQIAdqIRQgB0F/aiEXIAMoApgCIRkgAykDiAIhGANAAkACQCAYIBAgAmoxAACIQgGDUA0AIBYhDiAPIQEgDSECAkAgByAGTw0AA0ACQCABIAdqLQAAIBQgAmotAABGDQAgAkEBaiENDAQLIAFBAWohASACQQFqIQIgByAOQX9qIg5HDQALCwJAIBcgBk8NACAHRQ0IIBUgDWohASAHIQICQANAIBMgAmotAAAgASACai0AAEcNASACQX9qIgJFDQoMAAsLIA0gGWohDQwCCyADIAo2ApwBIAdFDQggFyAGI4GAgIAAQei+woAAahDQgoCAAAALIA0gBmohDQsgDSARaiICIBJJDQAMAwsLIAIgBiOBgICAAEHovsKAAGoQ0IKAgAAACyABQQFxDQILIApBBEcNAwwHCyABIQ0LIAMgCjYCnAELAkAgDUUNAAJAAkAgDSAISQ0AIA0gCEYNAgwBCyAJIA1qLAAAQb9/Sg0BCyAJIAhBACANI4GAgIAAQbjCwoAAahDcgoCAAAALIANBOGogCSANEJeAgIAAQQAhAgJAAkACQCADKAI8IhBBAEgNAAJAIBANAEEBIRoMAwsgAygCOCEBEISBgIAAQQEhAiAQQQEQgYGAgAAiGg0BIBAhGgsgAiAaELOCgIAAAAsgEEUNACAaIAEgEPwKAAALAkAgDSAMaiICRQ0AAkACQCAIIAJLDQAgCCACRw0BDAILIAkgAmosAABBv39KDQELIAkgCCACIAgjgYCAgABByMLCgABqENyCgIAAAAsgA0EBOwH4ASADQQA2AvABIANBAToA7AEgA0E6NgLoASADQQA2AuABIANBOjYC1AEgAyAIIAJrIgE2AvQBIAMgATYC5AEgAyABNgLcASADIAkgAmo2AtgBIANBATYC/AEgA0EwaiADQdQBahDogICAAAJAAkACQAJAIAMoAjAiAkUNACADKAI0IQEQhIGAgABBIEEEEIGBgIAAIg9FDQIgDyABNgIEIA8gAjYCAEEBIQIgA0EBNgLMAiADIA82AsgCIANBBDYCxAIgAyADKAL8ATYCqAIgAyADKQL0ATcDoAIgAyADKQLsATcDmAIgAyADKQLkATcDkAIgAyADKQLcATcDiAIgAyADKQLUATcDgAJBDCEBA0ACQAJAAkAgAygCqAIiBg4CBQABCyADQQA2AqgCIAMtAKUCDQQgA0EBOgClAgJAAkAgAy0ApAJBAUcNACADKAKgAiEOIAMoApwCIQcMAQsgAygCoAIiDiADKAKcAiIHRg0FCyADKAKEAiAHaiEGIA4gB2shBwwBCyADIAZBf2o2AqgCIANBKGogA0GAAmoQ6ICAgAAgAygCKCIGRQ0DIAMoAiwhBwsCQCACIAMoAsQCRw0AIANBxAJqIAJBAUEEQQgQmoCAgAAgAygCyAIhDwsgDyABaiIOIAc2AgAgDkF8aiAGNgIAIAMgAkEBaiICNgLMAiABQQhqIQEMAAsLIBBFDQcgGiAQQQEQgoGAgAAMBwsgAygCxAIhDiADQSBqIAMoAsgCIgYoAgAgBigCBBCXgICAAEEAIQcCQAJAIAMoAiQiAUEASA0AAkAgAQ0AQQEhGwwECyADKAIgIQ8QhIGAgABBASEHIAFBARCBgYCAACIbDQEgASEbCyAHIBsQs4KAgAAACyABRQ0BIBsgDyAB/AoAAAwBC0EEQSAQs4KAgAAACyADQRhqI4GAgIAAQfCjwIAAaiAGQQhqIAJBAUYbIgIoAgAgAigCBBCXgICAAAJAIAMoAhwiAkEATg0AQQAgHBCzgoCAAAALAkACQAJAIAJFDQAgAygCGCEHEISBgIAAIAJBARCBgYCAACIcDQFBASACELOCgIAAAAtBASEcIBBFDQEgAUUNAQwFCwJAIAJFDQAgHCAHIAL8CgAACwJAIBBFDQAgAQ0FCyAcIAJBARCCgYCAAAsCQCABRQ0AIBsgAUEBEIKBgIAACwJAIA5FDQAgBiAOQQN0QQQQgoGAgAALAkAgEEUNACAaIBBBARCCgYCAAAsgCkEERw0ADAQLCyADQcAAaiAJQQxqIAhBdGoQl4CAgABBACECAkACQCADKAJEIgFBAEgNAAJAIAENAEEBIR0MAwsgAygCQCEGEISBgIAAQQEhAiABQQEQgYGAgAAiHQ0BIAEhHQsgAiAdELOCgIAAAAsCQCABRQ0AIB0gBiAB/AoAAAsgAygCYCEOAkACQCADKAJkIgdFDQAgB0EMbCEGIA5BBGohAgNAAkAgAkEEaigCACABRw0AIAIoAgAgHSABEJqCgIAARQ0DCyACQQxqIQIgBkF0aiIGDQALCwJAIAcgAygCXEcNACADQdwAahDmgYCAACADKAJgIQ4LIA4gB0EMbGoiAiABNgIIIAIgHTYCBCACIAE2AgAgAyAHQQFqNgJkDAELIB0gAUEBEIKBgIAACyADQQhqIANB9ABqEOeAgIAAIAMoAgwhAiADKAIIIgENAwwFCwJAIA5FDQAgBiAOQQN0QQQQgoGAgAALIAMgCzoApAIgAyACNgKgAiADIBw2ApwCIAMgAjYCmAIgAyABNgKUAiADIBs2ApACIAMgATYCjAIgAyAQNgKIAiADIBo2AoQCIAMgEDYCgAICQAJAAkACQCADKAJkIgJFDQAgAkEMbCEOIAMoAmAhAkEAIQYDQAJAIAIgBmoiB0EIaigCACAQRw0AIAdBBGooAgAgGiAQEJqCgIAADQAgAiAOaiEGDAMLIA4gBkEMaiIGRw0ACwsgA0GcAWogA0GAAmoQuoKAgAACQCADKAJkIgIgAygCXEcNACADQdwAahDmgYCAAAsgAygCYCACQQxsIgZqIgEgAygCpAE2AgggASADKQKcATcCACADIAJBAWoiAjYCZCACRQ0BIAYgAygCYCICakEMaiEGIAMoApQCIQEgAygCkAIhGwsDQAJAIAJBCGooAgAgAUcNACACQQRqKAIAIBsgARCagoCAAEUNAwsgAkEMaiICIAZHDQALCyADQZwBaiAEELqCgIAAAkAgAygCZCICIAMoAlxHDQAgA0HcAGoQ5oGAgAALIAMoAmAgAkEMbGoiASADKAKkATYCCCABIAMpApwBNwIAIAMgAkEBajYCZAsCQCADKAJwIgEgAygCaEcNACADQegAahDdgICAAAsgAygCbCABQShsaiICIAMpAoACNwIAIAIgAykCiAI3AgggAiADKQKQAjcCECACIAMpApgCNwIYIAIgAykCoAI3AiAgAyABQQFqNgJwCyADQRBqIANB9ABqEOeAgIAAIAMoAhQhAiADKAIQIgENAQwDCwsgASENCyAGIAIgDSACI4GAgIAAQfjCwoAAahDcgoCAAAALAkACQCADKAJwRQ0AIAAgAykCXDcCACADIAMoAmQ2AogCIAMgAykCaDcCjAIgACADKQOIAjcCCCADIAMoAnA2ApQCIAAgAykDkAI3AhAMAQsgAEF/NgIAIANB6ABqEMGAgIAAIAMoAmAhBwJAIAMoAmQiAUUNACAHIQIDQAJAIAIoAgAiBkUNACACQQRqKAIAIAZBARCCgYCAAAsgAkEMaiECIAFBf2oiAQ0ACwsgAygCXCICRQ0AIAcgAkEMbEEEEIKBgIAACyADQdACaiSAgICAAAvsCAELfyOAgICAAEEgayICJICAgIAAQQEhAwJAIAFBARCOgYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCiACQRhqIAEQ84CAgAAgAigCHCEBAkACQCACKAIYQQFHDQAgAkEQaiABEPSAgIAAIAIoAhQhASACKAIQQQFHDQAgAkEIaiABELOAgIAAIAIoAgwhASACKAIIIQsMAQtBACELC0EBIQMgAS0AlAEhDAJAAkACQAJAAkACQCALQQFHDQAgDEH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAxB/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgxqIgYgCE0NACAGIAhrQQFGDQcLAkAgBSAMSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBBzoAACABIANBAWo2AjAgAS0AlAEhDAwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBBzoAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakEHQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIAxB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEMAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAw2AhAgA0EANgIIIAMgBzYCBCADQYEOOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABBtL7CgABqENCCgIAAAAsjgYCAgAAiAUG6ncCAAGpBKCABQcS+woAAahDCgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBB0EAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkEgaiSAgICAAAvwJgEQfyOAgICAAEHwAWsiAiSAgICAAEEBIQMCQCABQQEQjoGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASELAkAgAUEBEI6BgIAARQ0AIAEoAhghDCACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGYAWogARDUgICAACACKAKcASEBAkAgAigCmAFBAXENACABQQEQjoGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQjoGAgABFDQAgAkGQAWogARCygICAACACKAKUASEBAkAgAigCkAFBAXENACABQQEQjoGAgABFDQACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGIAWogARCygICAACACKAKMASEBAkAgAigCiAEiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQjoGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBgAFqIAEQsoCAgAAgAigChAEhAQJAIAIoAoABIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB+ABqIAEQ04CAgAAgAigCfCEBIAIoAnhBAXENACABQQEQjoGAgABFDQAgASgCGCEOIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQjoGAgABFDQAgAkHwAGogARCygICAACACKAJ0IQECQCACKAJwQQFxDQAgAUEBEI6BgIAARQ0AAkACQCABQQEQjoGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB6ABqIAEQsoCAgAAgAigCbCEBAkAgAigCaCIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHgAGogARCygICAACACKAJkIQECQCACKAJgIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB2ABqIAEQ1ICAgAAgAigCXCEBIAIoAlhBAXENAAJAIAFBARCOgYCAAA0AQQEhCwwBCyABKAIYIQ4gAiABKAKMATYCuAEgAiABKQKEATcDsAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhCyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkAgAUEBEI6BgIAARQ0AQQEhAwJAIAFBARCOgYCAAEUNACABKAIYIRAgAiABQYQBaiILKAIINgLIASACIAspAgA3A8ABIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASAPQQFqNgJUIAEoAlAgD0EDdGoiDyANNgIEIA8gDTYCAAJAIAFBARCOgYCAAEUNACABKAIYIQ8gAiALKAIINgLYASACIAspAgA3A9ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAAkACQCABQQEQjoGAgABFDQAgAkHQAGogARCygICAACACKAJUIQECQCACKAJQQQFxDQAgAUEBEI6BgIAARQ0AAkACQCABQQEQjoGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJByABqIAEQsoCAgAAgAigCTCEBAkAgAigCSCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkHAAGogARCygICAACACKAJEIQECQCACKAJAIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgC0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBOGogARDTgICAACACKAI8IQEgAigCOEEBcQ0AIAFBARCOgYCAAEUNACABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgACQAJAIAFBARCOgYCAAEUNACACQTBqIAEQsoCAgAAgAigCNCEBAkAgAigCMEEBcQ0AIAFBARCOgYCAAEUNAAJAAkAgAUEBEI6BgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiAiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyALQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkEYaiABENSAgIAAIAIoAhwhASACKAIYIQMLAkAgA0EBRw0AIAEgAigCyAE2AowBIAEgAikDwAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQsCQAJAIANBAXFFDQAgAyELDAELIAFBARCOgYCAAEUNACACQRBqIAEQ0oCAgAAgAigCFCEBAkAgAigCEEEBcQ0AA0AgAkEIaiABENKAgIAAIAIoAgwhASACKAIIQQFxRQ0ACwsgAS0ADEECRyELCwJAIAtBAUcNACABLQAMQQJHDQELQQAhCwsCQCALQQFHDQAgASACKAK4ATYCjAEgASACKQOwATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgC0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDQJAAkACQAJAAkACQCALQQFHDQAgDUH/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IAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAIAJBCGogARCygICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsgAS0ADEECRg0CCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAAC0EBIQsMAQsgAUE0ahCpgICAACACIAEQpYCAgAAgAigCBCEBIAIoAgAhCwsCQCALQQFHDQAgASACKAIoNgKMASABIAIpAyA3AoQBAkAgDCABKAIYSw0AIAEgDDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAC0EBIQMgAS0AlAEhDgJAAkACQAJAIAtBAUcNACAOQf8BcUEBRg0IIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgBksNAiABIAQ2AjAMAgsgDkH/AXFBAUcNBSABLQCVAUUNBgJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiBmoiCyAITQ0AIAsgCGtBAUYNCQsCQCAFIAZLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQcgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEUOgAAIAEgA0EBajYCMCABLQCUASEODAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEUOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEUQQAgCiABKAJ8IAlLGxCigICAAAwBC0EBQQMQs4KAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDkH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiILLQAADQEgCyADNgIEIAEoAowBIQYCQCABKAIYIgsgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAtBFGxqIgMgBjYCECADQQA2AgggAyAHNgIEIANBgSg7AQAgASALQQFqNgIYDAILIAcgAyOBgICAAEG0vsKAAGoQ0IKAgAAACyOBgICAACIBQbqdwIAAakEoIAFBxL7CgABqEMKCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEUQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQdAAaiSAgICAAAuKCQELfyOAgICAAEEgayICJICAgIAAQQEhAwJAIAFBARCOgYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCiACQRhqIAEQ94CAgAAgAigCHCEBAkACQAJAIAIoAhhBAUcNACACQRBqIAEQroCAgAAgAigCFCEBIAIoAhBBAUcNACACQQhqIAEQqoCAgAAgAigCDCEBIAIoAghBAXENAQtBACELDAELIAIgARCsgICAACACKAIEIQEgAigCACELC0EBIQMgAS0AlAEhDAJAAkACQAJAAkACQCALQQFHDQAgDEH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAxB/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgxqIgYgCE0NACAGIAhrQQFGDQcLAkAgBSAMSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBDToAACABIANBAWo2AjAgAS0AlAEhDAwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBDToAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakENQQAgCiABKAJ8IAlLGxCigICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIAxB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEMAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAw2AhAgA0EANgIIIAMgBzYCBCADQYEaOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABBtL7CgABqENCCgIAAAAsjgYCAgAAiAUG6ncCAAGpBKCABQcS+woAAahDCgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBDUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkEgaiSAgICAAAuTKQERfyOAgICAAEHgAWsiAiSAgICAAEEBIQMCQCABQQEQjoGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQoCQAJAAkACQAJAAkACQAJAIAFBARCOgYCAAEUNACABKAIYIQsgAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhAyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkAgAUEBEI6BgIAARQ0AIAEoAhghDiACIAFBhAFqIgMoAgg2ApgBIAIgAykCADcDkAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEI6BgIAARQ0AIAEoAhghECACIAMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEI6BgIAARQ0AIAEoAhghDyACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCOgYCAAEUNACACQfgAaiABEK+AgIAAIAIoAnwhAQJAIAIoAnhBAXENACABQQEQjoGAgABFDQACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIREgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHwAGogARCvgICAACACKAJ0IQECQCACKAJwIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEI6BgIAADQBBASEDDAELIAEoAhghESACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQegAaiABEK+AgIAAIAIoAmwhAQJAIAIoAmgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHgAGogARDRgICAACACKAJkIQEgAigCYCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkAgDEEBRg0AAkAgAUEBEI6BgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKoASACIAEpAoQBNwOgASABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASEDIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQjoGAgABFDQBBASEMAkAgAUEBEI6BgIAARQ0AIAEoAhghESACIAFBhAFqIgMoAgg2ArgBIAIgAykCADcDsAEgASgCPCENAkAgASgCVCIQIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhDCABIBBBAWo2AlQgASgCUCAQQQN0aiIQIA02AgQgECANNgIAAkAgAUEBEI6BgIAARQ0AIAEoAhghECACIAMoAgg2AsgBIAIgAykCADcDwAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCOgYCAAEUNACACQdgAaiABEK+AgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQjoGAgABFDQACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIRIgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHQAGogARCvgICAACACKAJUIQECQCACKAJQIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBIgASgCGEsNACABIBI2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEI6BgIAADQBBASEDDAELIAEoAhghEiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQcgAaiABEK+AgIAAIAIoAkwhAQJAIAIoAkgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgEiABKAIYSw0AIAEgEjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALIATYCjAEgASACKQPAATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAkHAAGogARDRgICAACACKAJEIQEgAigCQCEMCwJAIAxBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDAkACQCAMQQFxRQ0AIAwhAwwBCyABQQEQjoGAgABFDQAgAkE4aiABENCAgIAAIAIoAjwhAQJAIAIoAjhBAXENAANAIAJBMGogARDQgICAACACKAI0IQEgAigCMEEBcUUNAAsLIAEtAAxBAkchAwsCQCADQQFHDQAgAS0ADEECRw0BC0EAIQMLAkAgA0EBRw0AIAEgAigCqAE2AowBIAEgAikDoAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQAgAUEBEI6BgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCOgYCAAEUNACACQShqIAEQr4CAgAAgAigCLCEBAkAgAigCKEEBcQ0AIAFBARCOgYCAAEUNAAJAAkAgAUEBEI6BgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQSBqIAEQr4CAgAAgAigCJCEBAkAgAigCICIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAkEYaiABEK+AgIAAIAIoAhwhAQJAIAIoAhgiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQQLIAEtAAxBAkYNAwsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAACyABIAIoAogBNgKMASABIAIpA4ABNwKEAQJAIAsgASgCGEsNACABIAs2AhgLIAFBNGoQqICAgAALAkAgAUEBEI6BgIAARQ0AIAEoAhghDSACIAEoAowBNgLIASACIAEpAoQBNwPAASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCAAJAIAFBARCOgYCAAEUNACACQRBqIAEQr4CAgAAgAigCFCEBAkAgAigCEEEBcQ0AIAFBARCOgYCAAEUNAAJAAkAgAUEBEI6BgIAADQBBASEDDAELIAEoAhghCyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCmgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQQhqIAEQr4CAgAAgAigCDCEBAkAgAigCCCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCALIAEoAhhLDQAgASALNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIQsgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCIMIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDEEBajYCVCABKAJQIAxBA3RqIgwgAzYCBCAMIAM2AgAgAiABEK+AgIAAIAIoAgQhAQJAIAIoAgAiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgCyABKAIYSw0AIAEgCzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQcLIAEtAAxBAkYNBgsgASACKALIATYCjAEgASACKQPAATcChAECQCANIAEoAhhLDQAgASANNgIYCyABQTRqEKiAgIAAC0EBIQMgAS0AlAFBAUYNByABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAFBNGoiAxCpgICAACADEKmAgIAADAULIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEFOgAAC0EBIQMgAS0AgAFBAUcNASABLQCVAUUNASABQdgAakEFQQAgCiABKAJ8IAlLGxCigICAAAwBCyABQTRqEKmAgIAADAELIAEtAJQBQQJHDQEgAS0AlQFFDQEgByABKAIYSw0BIAEgBzYCGAwBCwJAAkAgAS0AlAEiA0EBRw0AIAEtAJUBRQ0BAkACQCABKAKQASIDIAZHDQACQCABKAIwIgMgASgCJCIMaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgDEsNACABIAU2AiQLIAQgA0sNASABIAQ2AjAgBCEDDAELIAYgA00NAiABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCKEcNACABQShqEKGAgIAACyABKAIsIANqQQU6AAAgASADQQFqNgIwIAEtAJQBIQMLIANB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEIAkAgASgCGCIGIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAGQRRsaiIDIAg2AhAgA0EANgIIIAMgBzYCBCADQYEKOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABBtL7CgABqENCCgIAAAAsjgYCAgAAiAUG6ncCAAGpBKCABQcS+woAAahDCgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBBUEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHgAWokgICAgAAL3xkBD38jgICAgABBoAFrIgIkgICAgABBASEDAkAgAUEBEI6BgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhCwJAIAFBARCOgYCAAEUNACABKAIYIQwgAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdgAaiABEPWAgIAAIAIoAlwhAQJAIAIoAlhBAXENACABQQEQjoGAgABFDQAgASgCGCEOIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdAAaiABELKAgIAAIAIoAlQhAQJAAkAgAigCUEEBcQ0AIAFBARCOgYCAAEUNACABKAIYIQ8gAiABKAKMATYCiAEgAiABKQKEATcDgAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQCABQQEQjoGAgABFDQAgAkHIAGogARCygICAACACKAJMIQECQCACKAJIQQFxDQAgAUEBEI6BgIAARQ0AAkACQCABQQEQjoGAgAANAEEBIQMMAQsgASgCGCEQIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBwABqIAEQsoCAgAAgAigCRCEBAkAgAigCQCIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCOgYCAAA0AQQEhAwwBCyABKAIYIRAgAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkE4aiABELKAgIAAIAIoAjwhAQJAIAIoAjgiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQMLIAEtAAxBAkYNAgsgASACKAKIATYCjAEgASACKQOAATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAACyABIAIoAng2AowBIAEgAikDcDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoiAxCpgICAACADEKmAgIAAIAJBMGogARC1gICAACACKAI0IQEgAigCMEEBcQ0AIAFBARCOgYCAAEUNACABKAIYIQ4gAiABKAKMATYCiAEg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QRBqJICAgIAAC1UBAX9BACECAkACQCAALQAMQQJHDQBBASECIAFFDQAgACgCAEEBcUUNACAAKAIEIgIgACgCCEkNAUEAIQIgAEEAOgAMCyACDwsgACACQQFqNgIEQQEL3wEBA38jgICAgABBEGsiAySAgICAAEEAIQQCQAJAIAJBAEgNAAJAIAINAEEBIQUMAgsQhIGAgABBASEEIAJBARCBgYCAACIFRQ0AIAJFDQEgBSABIAL8CgAADAELIAQgAhCzgoCAAAALIANBBGogBSACQQ0jgYCAgAAiBEGArcGAAGoQh4GAgAAgACADKAIIIgEgAygCDEEKIARBg63BgABqEIeBgIAAAkAgAygCBCIARQ0AIAEgAEEBEIKBgIAACwJAIAJFDQAgBSACQQEQgoGAgAALIANBEGokgICAgAALMwEBfyAAQQI6AAwgAEEANgIEIAAjgYCAgABBsM3CgABqKAIAIgE2AgggACABQQBHNgIACwkAEK2BgIAAAAtNAQF/I4CAgIAAQRBrIgYkgICAgAAgBiACNgIMIAYgATYCCCAAIAZBCGojgYCAgABBsMTCgABqIgIgBkEMaiACIAMgBCAFEMGCgIAAAAsmAQF/I4GAgIAAIgBBorLBgABqQe8AIABB6MfCgABqEMeCgIAAAAsaAAJAIAAtAABBA0cNACAAQQRqEO+CgIAACwsgAQF/AkAgACgCACIBRQ0AIAAoAgQgAUEBEIKBgIAACwsaAAJAIAAtAABBA0cNACAAQQRqEO+CgIAACwsgAQF/AkAgACgCACIBRQ0AIAAoAgQgAUEBEIKBgIAACwsiAQF/AkAgACgCACIBQQFIDQAgACgCBCABQQEQgoGAgAALCwsAIAAQmoGAgAAACzoBAn8jiYCAgAAoAgAhASOKgICAACECIAAoAgAgACgCBCABIAIgARsRgYCAgACAgICAABClgYCAAAALCwAgABCcgYCAAAALqAEBA38jgICAgABBEGsiASSAgICAAAJAIAAoAgAiAigCBCIDQQFxRQ0AIAIoAgAhAiABIANBAXY2AgQgASACNgIAIAEjgYCAgABB2MXCgABqIAAoAgQgACgCCCIALQAIIAAtAAkQoIGAgAAACyABQX82AgAjgYCAgAAhAiABIAA2AgwgASACQfTFwoAAaiAAKAIEIAAoAggiAC0ACCAALQAJ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m8CAAGogAkEQahCrgYCAACACQQRqEJSBgIAAEKeBgIAAIQECQAJAAkACQBC4gYCAAEH/AXEOAwABAgMLIAJBEGogAkEfaiOCgICAAEGLgICAAGpBABCogYCAACACQRBqEJSBgIAADAILIAJBEGogAkEfaiOCgICAAEGLgICAAGpBARCogYCAACACQRBqEJSBgIAADAELIAJBEGogAkEfaiOBgICAAEGTrsGAAGpBnQEQq4GAgAAgAkEQahCUgYCAAAsgAUEAOgAADAELIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEHKmsCAAGogAkEQahCrgYCAACACQQRqEJSBgIAACyACQSBqJICAgIAACwkAELmBgIAAAAu8AgMCfwF+AX8jgICAgABBIGsiAySAgICAABCngYCAACEEIAApAgAhBSADIAI2AhggAyABNgIUIAMgBTcCDAJAAkAjj4CAgAAoAgAiBkECSw0AIANBDGpBABChgYCAAAwBCyADIAZBeGo2AhwgA0EMaiADQRxqEKGBgIAACwJAAkACQAJAIAAoAggtAAAOAwABAgMLIANBDGogASACKAIkQQAQqIGAgAAgA0EMahCUgYCAAAwCCyADQQxqIAEgAigCJEEBEKiBgIAAIANBDGoQlIGAgAAMAQsjgYCAgABB7MbCgABqIgAtAAAhBiAAQQA6AAAgBkUNACADQQxqIAEjgYCAgABBk67BgABqQZ0BIAIoAiQRgoCAgACAgICAACADQQxqEJSBgIAACyAEQQA6AAAgA0EgaiSAgICAAAuOAQEDfyOAgICAAEEQayIAJICAgIAAI4GAgIAAQZnOwoAAaiIBLQAAIQIgAUEBOgAAIAAgAjoADwJAIAJBAUcNACOBgICAACECQQAgAEEPaiOQgICAACACQeevwYAAakHBACACQazGwoAAahCSgYCAAAALI4GAgIAAIQIgAEEQaiSAgICAACACQZnOwoAAagtgAQF/I4CAgIAAQRBrIgQkgICAgAAgBCADOgAHIAQjkYCAgACtQiCGIARBB2qthDcDCCAAIAEjgYCAgABByoTAgABqIARBCGogAhGCgICAAICAgIAAIARBEGokgICAgAALmAMBA38jgICAgABBMGsiASSAgICAAEH/ASECAkAgAC0ADQ0AQQEhAiOBgICAAEG8zcKAAGooAgBBAUsNABC4gYCAACECCyABIAI6AAsgASAAKAIINgIMIAEgACgCACAAKAIEELqBgIAAIAEgASkDADcCECOBgICAAEH0zcKAAGotAAAhACABIAFBC2o2AiAgASABQRBqNgIcIAEgAUEMajYCGAJAAkACQCAARQ0AI4GAgIAAIgBB9M3CgABqQQE6AAAgAEG4zcKAAGoiAigCACEAIAJBADYCACAADQELIAFBGGogAUEvaiOBgICAAEHwxsKAAGoQpoGAgAAMAQsjgYCAgAAhAiABQRhqIABBCGoQtYGAgAAiA0EEaiACQZjHwoAAahCmgYCAACADQQA6AAAgAkH0zcKAAGpBAToAACACQbjNwoAAaiIDKAIAIQIgAyAANgIAIAEgAjYCKCABQQE2AiQgAkUNACACIAIoAgAiAEF/ajYCACAAQQFHDQAgAUEkakEEahC2gYCAAAsgAUEwaiSAgICAAAtuAQF/I4CAgIAAQSBrIgIkgICAgAAgAiAAIAEQkYGAgAA2AgQgAiOOgICAAK1CIIYgAkEEaq2ENwMQIAJBCGogAkEfaiOBgICAAEGqm8CAAGogAkEQahCrgYCAACACQQhqEJSBgIAAEKWBgIAAAAu5AQEBfyOAgICAAEEQayIEJICAgIAAIABB/wE6AAAgBCABNgIIIAQgACkCADcDACAEI4GAgIAAQYDFwoAAaiACIAMQxoKAgAAhASAELQAAIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQYatwYAAakGtASAEQdjEwoAAahDHgoCAAAALIANB/wFxQQNHDQEgBEEEchDvgoCAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAALcQEBfyOAgICAAEEQayICJICAgIAAAkACQAJAIAFBCEsNACABIABNDQELIAJBADYCDCACQQxqIAFBBCABQQRLGyAAEK6CgIAAIQFBACACKAIMIAEbIQEMAQsgABCmgoCAACEBCyACQRBqJICAgIAAIAELCQAQpYGAgAAACwoAIAAQqYKAgAALnQEBAn8jgICAgABBEGsiBCSAgICAAAJAAkACQCACQQhLDQAgAiADTQ0BC0EAIQUgBEEANgIMIARBDGogAkEEIAJBBEsbIAMQroKAgAANASAEKAIMIgJFDQECQCADIAEgAyABSRsiA0UNACACIAAgA/wKAAALIAAQqYKAgAAgAiEFDAELIAAgAxCsgoCAACEFCyAEQRBqJICAgIAAIAULOAIBfwF+I4CAgIAAQRBrIgEkgICAgAAgACkCACECIAEgADYCDCABIAI3AgQgAUEEahCbgYCAAAALDQAgASAAELKBgIAAAAsvAQF/I4CAgIAAQRBrIgIkgICAgAAgAiABNgIMIAIgADYCCCACQQhqEJmBgIAAAAvvAQIDfwF+I4CAgIAAQRBrIgIkgICAgAAgASgCBCEDIAEoAgAhBCAALQAAIQAgAkEEahC3gYCAACACKQIIIQUCQCACKAIEIgFBf0cNACAFQv8Bg0IDUg0AIAJBDGoQ74KAgAALAkACQAJAAkAgBCOBgICAAEGLscGAAGpBESADKAIMIgMRg4CAgACAgICAAA0AIABBAXENASAEI4GAgIAAQZyxwYAAakHYACADEYOAgIAAgICAgABFDQELQQEhBCABQQBKDQEMAgtBACEEIAFBAEwNAQsgBacgAUEBEIKBgIAACyACQRBqJICAgIAAIAQL8QIBAn8jgICAgABBoANrIgMkgICAgAACQAJAAkACQCACQf8CSw0AAkAgAkUNACADQRRqIAEgAvwKAAALIANBFGogAmpBADoAACADQZQDaiADQRRqIAJBAWoQ0YKAgAACQCADKAKUA0EBRw0AQX4hAiADQX42AgggAyOBgICAAEGoxcKAAGopAwA3AgwMAgsCQCADKAKYAxCZgoCAACIBRQ0AAkACQCABEKOCgIAAIgINAEEBIQQMAQsQhIGAgAAgAkEBEIGBgIAAIgRFDQQgAkUNACAEIAEgAvwKAAALIAMgAjYCECADIAQ2AgwgAyACNgIIDAILQX8hAiADQX82AggMAQsgA0EIaiABIAIQn4GAgAAgAygCCCECCwJAIAJBfkYNACAAIAMpAgw3AgQgACACNgIADAILAkAgAy0ADEEDRw0AIANBEGoQ74KAgAALIABBfzYCAAwBC0EBIAIQs4KAgAAACyADQaADaiSAgICAAAtyAQJ/I4CAgIAAQRBrIgEkgICAgAAgAC0AACECIABBAToAACABIAI6AA8CQCACQQFHDQAjgYCAgAAhAEEAIAFBD2ojkICAgAAgAEHnr8GAAGpBwQAgAEGsxsKAAGoQkoGAgAAACyABQRBqJICAgIAAIAALVwEBfwJAIAAoAgAiAEEMaigCACIBRQ0AIABBEGooAgAgAUEBEIKBgIAACwJAIABBf0YNACAAIAAoAgQiAUF/ajYCBCABQQFHDQAgAEEYQQQQgoGAgAALC4sDAQZ/I4CAgIAAQRBrIgEkgICAgAAQhIGAgABBgAQhAgJAAkACQAJAQYAEQQEQgYGAgAAiA0UNACABIAM2AgggAUGABDYCBAJAAkAgA0GABBDzgYCAAA0AQYAEIQIDQCOBgICAACEEI5KAgIAAKAIAIQUjk4CAgAAoAgAhBgJAIAUgBEGQxsKAAGpGDQAjgYCAgABBkMbCgABqEOyCgIAACyAGQcQARw0CIAEgAjYCDCABQQRqIAJBAUEBQQEQnoGAgAAgASgCCCIDIAEoAgQiAhDzgYCAAEUNAAsLIAEgAxCjgoCAACIGNgIMIAIgBk0NAwJAIAYNAEEBIQQgAyACQQEQgoGAgAAMAwsgAyACQQEgBhCDgYCAACIEDQJBASAGELOCgIAAAAsgAEF/NgIAIAAgBq1CIIY3AgQgAkUNAyADIAJBARCCgYCAAAwDC0EBQYAEELOCgIAAAAsgASAGNgIEIAEgBDYCCAsgACABKAIMNgIIIAAgASkCBDcCAAsgAUEQaiSAgICAAAukAgEFfyOAgICAAEEQayIAJICAgIAAQQMhAQJAI4GAgIAAQeTNwoAAai0AAEF/aiICQf8BcUEDSQ0AIABBBGojgYCAgABB2a/BgABqQQ4QtIGAgAACQAJAIAAoAgQiA0F/Rw0AQQIhAgwBCwJAAkACQAJAIAAoAgxBf2oOBAACAgECCyAAKAIIIgQtAABBMEcNAUEDIQFBAiECIAMNAgwDCyAAKAIIIgQoAABB5uqx4wZHDQBBAiEBQQEhAiADDQEMAgtBASEBQQAhAiADRQ0BIAAoAgghBAsgBCADQQEQgoGAgAALI4GAgIAAQeTNwoAAaiIDIAMtAAAiAyABIAMbOgAAIANFDQAgA0F/akF/IANBBEkbIQILIABBEGokgICAgAAgAgsJABDygYCAAAAL8gECA38CfiOAgICAAEEQayIDJICAgIAAIAMgASACKAIMIgQRgYCAgACAgICAAEEEIQIgASEFAkACQCADKQMAQtzsp//F24D7uX+FIAMpAwhC8YPD46a+2OAkhYRQDQAgAyABIAQRgYCAgACAgICAACADKQMIIQYgAykDACEHI4GAgIAAIQICQCAHQo/OmIuvtIWCin+FIAZCzM7O7+/OwO/xAIWEQgBRDQAgAkHSsMGAAGohAUEMIQIMAgsgAUEEaiEFQQghAgsgASACaigCACECIAUoAgAhAQsgACACNgIEIAAgATYCACADQRBqJICAgIAAC9oCAQV/I4CAgIAAQRBrIgQkgICAgAACQAJAIANFDQAgBEEMaiEFA0ACQAJAAkACQAJAQQIgAiADEO6BgIAAIgZBf0cNACOBgICAACEHI5KAgIAAKAIAIQgjk4CAgAAoAgAhBgJAIAggB0GQxsKAAGpGDQAjgYCAgABBkMbCgABqEOyCgIAACyAEQQA6AAsgBEEAOwAJIAQgBjYCDCAEQQA6AAggBhDngoCAACgCCBGAgICAAICAgIAADQMgBEEIaiEGDAELIARB/wE6AAggBCAGNgIMI4GAgIAAIQcgBg0BIAdB0MfCgABqIQYLIAAgBikCADcCAAwFCwJAIAMgBkkNACACIAZqIQIgAyAGayEDDAILIAYgAyADI4GAgIAAQajIwoAAahDIgoCAAAALIAQtAAhBA0cNACAFEO+CgIAACyADDQALCyAAQf8BOgAACyAEQRBqJICAgIAAC20BAn8jlICAgAAiASABKAIAIgJBAWo2AgBBACEBAkAgAkEASA0AQQEhASOBgICAAEHAzcKAAGotAAANACOBgICAACIBQcDNwoAAaiAAOgAAIAFBvM3CgABqIgEgASgCAEEBajYCAEECIQELIAELHAAgACgCACABIAAoAgQoAgwRhICAgACAgICAAAsKACAAEOqBgIAACwcAIABBG0YLLwEBf0ErIQECQCAAQX9qIgBBygBLDQAjgYCAgABB/7LBgABqIABqLQAAIQELIAELJQEBfyAAI4GAgIAAQfSuwYAAaiICKQIINwIIIAAgAikCADcCAAslAQF/IAAjgYCAgABB5K7BgABqIgIpAgg3AgggACACKQIANwIAC8EBBAN/AX4CfwF+QQAhAwJAQQAgACgCCCIEKAIEIgUgBCkDCCIGQv////8PIAZC/////w9UG6drIgcgByAFSxsiByACIAcgAkkbIghFDQAgBCgCACAGIAWtIgkgBiAJVBunaiABIAj8CgAACyAEIAYgCK18NwMIAkAgByACTw0AI4GAgIAAQdDH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AkAgACkDCCIEUA0AIAQQkIKAgAAhByADIAY2AhAgAyADQRBqNgIYIAcQ+oGAgAAhBiADQQI2AhwgAyAGNgIUIANBGGogA0EIahCFgoCAACAHEPmBgIAAIAMoAgwiB0UNASADKAIIIQYCQANAIAYoAgBBAUYNASAGQQRqIQYgB0F/aiIHRQ0DDAALCyOTgICAAEEGNgIAIANBCGoQ+4GAgABBfyEGDAgLIAYQhIKAgAAMAQsgA0EIahD7gYCAAAsgACgCECADQSBqIANBKGoQhoKAgAANAAwECwsgAygCLBD4gYCAAEEdIQYLI5OAgIAAIAY2AgBBfyEGDAILIAMpAyAiBKciBkEBSA0BIAAoAgAiB0UNASAHIAcpAwAgBEL/////B4N8NwMADAELQcAAIQYCQCADLQAoQQFGDQAgAygCLBD4gYCAAEEdIQYLI5OAgIAAIAY2AgBBfyEGCyADQTBqJICAgIAAIAYLewECfwJAIAAoAgQiAUUNACAAKAIAIgIhAANAAkAgAEEEaigCAEUNACAAKAIAEKmCgIAACyAAQgA3AgACQCAAQQxqKAIARQ0AIABBCGooAgAQqYKAgAALIABBCGpCADcCACAAQRBqIQAgAUF/aiIBDQALIAIQqYKAgAALCwoAIAAQgYCAgAALCgAgABCCgICAAAsEACAACxgAAkAgACgCBEUNACAAKAIAEKmCgIAACwsKACAAEIOAgIAACwQAIAALCgAgABCEgICAAAsEACAACwoAIAAQhYCAgAALCgAgABCGgICAAAs1AQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCHgICAACAAIAEpAgg3AgAgAUEQaiSAgICAAAsOACAALQAAEIiAgIAAAAsKACAAEImAgIAACz8BAX8jgICAgABBEGsiAiSAgICAACAAKAIAIAAoAgQgAkEIahCKgICAACABIAIpAgg3AgAgAkEQaiSAgICAAAt3AgF/AX4jgICAgABBEGsiAySAgICAACAAIAMQi4CAgAACQAJAAkACQCADLQAADgIAAgELIAMpAwghBAsgASAENwMAQQEhAAwBCyACIAM1AgxCIIZCACADMQAIIgRQGyAEhDcCAEEAIQALIANBEGokgICAgAAgAAtcAQF/I4CAgIAAQRBrIgMkgICAgAAgACABKAIAIAEoAgQgA0EEahCMgICA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CyADQQRqIAAoAgAiAiAAKAIEIAEgAkEBdCICIAEgAksbIgJBCCACQQhLGyICELSCgIAAAkAgAygCBEEBRw0AIAMoAgggAygCDBCzgoCAAAALIAMoAgghASAAIAI2AgAgACABNgIEIANBEGokgICAgAALHAACQCAARQ0AIAAgARC2goCAAAALELiCgIAAAAuQAQACQAJAIANBAE4NAEEBIQFBBCECQQAhAwwBCwJAAkACQAJAIAFFDQAgAiABQQEgAxCDgYCAACEBDAELAkAgAw0AQQEhAQwCCxCEgYCAACADQQEQgYGAgAAhAQsgAQ0AQQEhASAAQQE2AgQMAQsgACABNgIEQQAhAQtBCCECCyAAIAJqIAM2AgAgACABNgIAC5wFAQR/I4CAgIAAQTBrIgMkgICAgAAgAyACNgIIIAMgATYCBCADQRRqIANBBGoQ7YKAgAACQAJAAkACQCADKAIUIgRFDQAgAygCGCEBIAMoAiBFDQECQAJAIAINAEEBIQUMAQsQhIGAgAAgAkEBEIGBgIAAIgVFDQMLQQAhBiADQQA2AiwgAyAFNgIoIAMgAjYCJAJAAkACQCABIAJNDQAgA0EkakEAIAEQsoKAgAAgAygCJCECIAMoAighBSADKAIsIQYMAQsgAUUNAQsgAUUNACAFIAZqIAQgAfwKAAALIAMgBiABaiIBNgIsAkAgAiABa0ECSw0AIANBJGogAUEDELKCgIAAIAMoAighBSADKAIsIQELIAUgAWoiAiOBgICAAEGawcGAAGoiBC0AAjoAAiACIAQvAAA7AAAgAyABQQNqIgI2AiwgAyADKQIENwIMIANBFGogA0EMahDtgoCAAAJAIAMoAhQiBUUNAANAIAMoAiAhBAJAAkACQCADKAIYIgEgAygCJCACa00NACADQSRqIAIgARCygoCAACADKAIsIQIMAQsgAUUNAQsgAUUNACADKAIoIAJqIAUgAfwKAAALIAMgAiABaiICNgIsAkAgBEUNAAJAIAMoAiQgAmtBAksNACADQSRqIAJBAxCygoCAACADKAIsIQILIAMoAiggAmoiASOBgICAAEGawcGAAGoiBC8AADsAACABIAQtAAI6AAIgAyACQQNqIgI2AiwLIANBFGogA0EMahDtgoCAACADKAIUIgUNAAsLIAAgAygCLDYCCCAAIAMpAiQ3AgAMAwtBACEBQQEhBAsgACABNgIIIAAgBDYCBCAAQX82AgAMAQtBASACELOCgIAAAAsgA0EwaiSAgICAAAsNACABIAAQsYGAgAAAC+UBAQR/I4CAgIAAQRBrIgIkgICAgAACQAJAAkAgASgCACIDIAEoAggiBEcNACACQQRqIAQgASgCBCAEQQFqIgMQtIKAgAAgAigCBEEBRg0BIAEgAigCCDYCBAsgASgCBCIFIARqQQA6AAACQAJAIAMgBEEBaiIBSw0AIAUhBAwBCwJAIAENAEEBIQQgBSADQQEQgoGAgAAMAQsgBSADQQEgARCDgYCAACIERQ0CCyAAIAE2AgQgACAENgIAIAJBEGokgICAgAAPCyACKAIIIAIoAgwQs4KAgAAAC0EBIAEQs4KAgAAACyUBAX8jgYCAgAAiAEGdwcGAAGpBIyAAQazKwoAAahDHgoCAAAALuwMBBn8jgICAgABBEGsiAySAgICAAAJAAkACQAJAAkACQAJAIAJBAXFFDQAgAkEBdiEEDAELIAEtAAAiBEUNAUEAIQUgASEGQQAhBwNAIAZBAWohBgJAAkAgBMBBf0oNAAJAIARB/wFxQYABRw0AIAUgBi8AACIEaiEFIAYgBGpBAmohBgwCCyAGIARBA3FBCHgiCEEFdEGAgICABHEgCEEHdHJBHXZqIARBAXZBAnFqIARBAnZBAnFqIQYgBUUgB3IhBwwBCyAGIARB/wFxIgRqIQYgBSAEaiEFCyAGLQAAIgQNAAtBACEEIAcgBUEQSXENAEEAIQcgBUEBdCIEQQBIDQQLIAQNAQtBASEGQQAhBAwBCxCEgYCAAEEBIQcgBEEBEIGBgIAAIgZFDQELIANBADYCCCADIAY2AgQgAyAENgIAIAMjgYCAgABBvMrCgABqIAEgAhDGgoCAAEUNASOBgICAACIEQa7BwYAAakHWACADQQ9qIARB1MrCgABqIARB5MrCgABqEOKCgIAAAAsgByAEELOCgIAAAAsgACADKAIINgIIIAAgAykCADcCACADQRBqJICAgIAAC2gBAn8CQAJAAkAgASgCCCICDQBBASEBDAELIAEoAgQhAxCEgYCAACACQQEQgYGAgAAiAUUNASACRQ0AIAEgAyAC/AoAAAsgACACNgIIIAAgATYCBCAAIAI2AgAPC0EBIAIQs4KAgAAACxkAIAEjgYCAgABBhMLBgABqQQUQ2YKAgAALigEBAn8CQCABKAIAQX9GDQAgACABKAIINgIIIAAgASkCADcCAA8LAkACQAJAIAEoAggiAg0AQQEhAQwBCyABKAIEIQMQhIGAgAAgAkEBEIGBgIAAIgFFDQEgAkUNACABIAMgAvwKAAALIAAgAjYCCCAAIAE2AgQgACACNgIADwtBASACELOCgIAAAAuaAgEGfyAAKAIIIQICQAJAIAFBgAFPDQBBASEDDAELAkAgAUGAEE8NAEECIQMMAQtBA0EEIAFBgIAESRshAwsCQCADIAAoAgAgAmtNDQAgACACIAMQsoKAgAALIAAoAgQgAmohBAJAAkAgAUGAAUkNACABQT9xQYB/ciEFIAFBBnYhBgJAIAFBgBBPDQAgBCAFOgABIAQgBkHAAXI6AAAMAgsgAUEMdiEHIAZBP3FBgH9yIQYCQCABQf//A0sNACAEIAU6AAIgBCAGOgABIAQgB0HgAXI6AAAMAgsgBCAFOgADIAQgBjoAAiAEIAdBP3FBgH9yOgABIAQgAUESdkFwcjoAAAwBCyAEIAE6AAALIAAgAyACajYCCEEAC1oBAX8CQAJAAkAgAiAAKAIAIAAoAggiA2tNDQAgACADIAIQsoKAgAAgACgCCCEDDAELIAJFDQELIAJFDQAgACgCBCADaiABIAL8CgAACyAAIAMgAmo2AghBAAv5AgEEfyOAgICAAEEgayIDJICAgIAAQQAhBAJAIAJBAWoiBUEASA0AEISBgIAAQQEhBCAFQQEQgYGAgAAiBkUNAAJAAkAgAkUNAAJAIAJFDQAgBiABIAL8CgAACwJAAkAgAkEISQ0AIANBCGpBACABIAIQ5YKAgAAgAygCCEEBcUUNAiADKAIMIQQMAQsCQCABLQAADQBBACEEDAELQQEhBCACQQFGDQEgAS0AAUUNAEECIQQgAkECRg0BIAEtAAJFDQBBAyEEIAJBA0YNASABLQADRQ0AQQQhBCACQQRGDQEgAS0ABEUNAEEFIQQgAkEFRg0BIAEtAAVFDQBBBiEEIAJBBkYNASABLQAGDQELIAAgBDYCDCAAIAI2AgggACAGNgIEIAAgBTYCAAwBCyADIAI2AhwgAyAGNgIYIAMgBTYCFCADIANBFGoQt4KAgAAgACADKQMANwIEIABBfzYCAAsgA0EgaiSAgICAAA8LIAQgBRCzgoCAAAALGwAgACOBgICAAEG8ysKAAGogASACEMaCgIAAC9cCAgF/AX4jgICAgABBwABrIggkgICAgAAgCCACNgIEIAggATYCACAIIAQ2AgwgCCADNgIIIAgjgYCAgAAiAkGsvsKAAGogAEH/AXEiAWotAAA2AhQgCCACQZTNwoAAaiABQQJ0aigCADYCEAJAIAVFDQAgCCAGNgIcIAggBTYCGCAII5iAgIAArUIghiAIQRhqrYQ3AyggCCOCgICAACIFQcaAgIAAaq1CIIYiCSAIQQhqrYQ3AzggCCAJIAithDcDMCAIIAVBx4CAgABqrUIghiAIQRBqrYQ3AyAjgYCAgABB84PAgABqIAhBIGogBxDHgoCAAAALIAgjgoCAgAAiBUHGgICAAGqtQiCGIgkgCEEIaq2ENwMwIAggCSAIrYQ3AyggCCAFQceAgIAAaq1CIIYgCEEQaq2ENwMgI4GAgIAAQbyDwIAAaiAIQSBqIAcQx4KAgAAACxUAIAAgAUEBdEEBciACEMeCgIAAAAvVAwQBfwF+A38FfiOAgICAAEEgayIDJICAgIAAIABC/w83AwhCACEEIABCADcDAEEAIQUCQAJAIAFCqn1TDQAgAlANACABQrQCVQ0BQgAhBCADQRBqI5mAgIAAIAGnIgZBBHRqIgdB4CpqKQMAQgAgAiACeSIIhiIJQgAQ9YKAgAAgAykDECEKAkAgAykDGCICQv8Dg0L/A1INACADIAdB6CpqKQMAQgAgCUIAEPWCgIAAIAMpAwgiCSAKfCIKIAlUrSACfCECCwJAIAFCG3xC0wBUDQAgCkJ/Ug0AQX8hBQwBCyACIAJCP4giC0IJfCIMiCEJAkAgBkHqpA1sQRB1IAinayALp2pBP2oiBkGCeEgNAEGACEH/ByAJQvz/////////AIMgCSAJIAyGIAJRGyAJIAlCA4NCAVEbIAkgCkICVBsgCSABQgR8QhxUGyIBQgGDIAF8IgFC/////////x9WIgcbIAZqIgVB/g9LDQJCACABQgGIQv/////////3/wCDIAcbIQQMAQsgBkHDd0kNACAJQYJ4IAZrrYgiAUIBgyABfCIBQv////////8PViEFIAFCAYghBAsgACAFNgIIIAAgBDcDAAsgA0EgaiSAgICAAAvnAgUCfwJ+AX8BfgJ/I4CAgIAAQSBrIgIkgICAgABBFCEDIAApAwAiBCEFAkAgBELoB1QNAEEUIQMgBCEFA0AgAkEMaiADaiIAQXxqI4GAgIAAQenXwYAAaiIGIAUiByAHQpDOAIAiBUKQzgB+faciCEH//wNxQeQAbiIJQQF0ai8AADsAACAAQX5qIAYgCCAJQeQAbGtB//8DcUEBdGovAAA7AAAgA0F8aiEDIAdC/6ziBFYNAAsLAkAgBUIJWA0AIAJBDGogA0F+aiIDaiOBgICAAEHp18GAAGogBaciACAAQf//A3FB5ABuIgBB5ABsa0H//wNxQQF0ai8AADsAACAArSEFCwJAAkAgBFANACAFUA0BCyACQQxqIANBf2oiA2ojgYCAgABB6dfBgABqIAWnQQF0ai0AAToAAAsgAUEBQQFBACACQQxqIANqQRQgA2sQ1YKAgAAhAyACQSBqJICAgIAAIAMLFAAgASAAKAIAIAAoAgQQ2IKAgAAL9AQBCH8jgICAgABBEGsiBCSAgICAAAJAAkACQCADQQFxDQAgAi0AACIFDQFBACEFDAILIAAgAiADQQF2IAEoAgwRg4CAgACAgICAACEFDAELIAEoAgwhBkEAIQcDQCACQQFqIQgCQAJAAkACQAJAIAXAQX9KDQAgBUH/AXEiCUGAAUYNASAJQcABRw0DIAQgATYCBCAEIAA2AgAgBEKggICABjcCCCADIAdBA3RqIgUoAgAgBCAFKAIEEYSAgIAAgICAgABFDQJBASEFDAYLAkAgACAIIAVB/wFxIgUgBhGDgICAAICAgIAADQAgCCAFaiECDAQLQQEhBQwFCwJAIAAgAkEDaiIFIAIvAAEiAiAGEYOAgIAAgICAgAANACAFIAJqIQIMAwtBASEFDAQLIAdBAWohByAIIQIMAQtBoICAgAYhCgJAIAVBAXFFDQAgAkEFaiEIIAIoAAEhCgtBACEJAkACQCAFQQJxDQBBACELIAghAgwBCyAIQQJqIQIgCC8AACELCwJAAkAgBUEEcQ0AIAIhCAwBCyACQQJqIQggAi8AACEJCwJAAkAgBUEIcQ0AIAghAgwBCyAIQQJqIQIgCC8AACEHCwJAIAVBEHFFDQAgAyALQf//A3FBA3RqLwEEIQsLAkAgBUEgcUUNACADIAlB//8DcUEDdGovAQQhCQsgBCAJOwEOIAQgCzsBDCAEIAo2AgggBCABNgIEIAQgADYCAAJAIAMgB0EDdGoiBSgCACAEIAUoAgQRhICAgACAgICAAEUNAEEBIQUMAwsgB0EBaiEHCyACLQAAIgUNAAtBACEFCyAEQRBqJICAgIAAIAULRwEBfyOAgICAAEEgayIDJICAgIAAIAMgATYCECADIAA2AgwgA0EBOwEcIAMgAjYCGCADIANBDGo2AhQgA0EUahCwgYCAAAAL6QICAX8BfiOAgICAAEEgayIEJICAgIAAAkACQAJAIAAgAksNACABIAJLDQEjjoCAgACtQiCGIQUgACABTQ0CIAQgADYCCCAEIAE2AgwgBCAFIARBDGqthDcDGCAEIAUgBEEIaq2ENwMQI4GAgIAAQYiAwIAAaiAEQRBqIAMQx4KAgAAACyAEIAA2AgggBCACNgIMIAQjjoCAgACtQiCGIgUgBEEMaq2ENwMYIAQgBSAEQQhqrYQ3AxAjgYCAgABBl4LAgABqIARBEGogAxDHgoCAAAALIAQgATYCCCAEIAI2AgwgBCOOgICAAK1CIIYiBSAEQQxqrYQ3AxggBCAFIARBCGqthDcDECOBgICAAEHQgsCAAGogBEEQaiADEMeCgIAAAAsgBCABNgIIIAQgAjYCDCAEIAUgBEEMaq2ENwMYIAQgBSAEQQhqrYQ3AxAjgYCAgABB0ILAgABqIARBEGogAxDHgoCAAAAL3QUBA38jgICAgABBEGsiAySAgICAAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAQ4oBgEBAQEBAQEBBAMBAQUBAQEBAQEBAQEBAQEBAQEBAQEBAQgBAQEBBwALIAFB3ABGDQELIAFBYGpB3wBJDQwgAUH+//8AcUGe/wNGDQwgAUEgSQ0NIAFBgX9qQSFJDQ0gAUGAwHxqQYAySQ0NIAFBgIBEakH+/wNJDQ0gAUEgRg0NIAFBgIBAakH+/wNJDQ0gAUGFAUkNCyABEMyCgIAADQ0CQCABQYAGSQ0AIAJBAXENCAsgAUGsAUsNCAwLCyAAQgA3AQIgAEHcuAE7AQAMCQsgAEIANwECIABB3NwBOwEADAgLIABCADcBAiAAQdzoATsBAAwHCyAAQgA3AQIgAEHc5AE7AQAMBgsgAEIANwECIABB3OAAOwEADAULIAJBgAJxRQ0GIABCADcBAiAAQdzOADsBAAwECyACQf///wdxQYCABE8NAgwFCyABEM2CgIAADQULIAEQzoKAgAANBCABEM+CgIAARQ0CDAQLIABCADcBAiAAQdzEADsBAAtBAiEBQQAhAgwDCyABEMqCgIAARQ0BCyAAIAE2AgBBgQEhAUGAASECDAELIANBADoACCADQQA7AQYgAyOBgICAAEGQ18GAAGoiBCABQRR2ai0AADoACSADIAQgAUEEdkEPcWotAAA6AA0gAyAEIAFBCHZBD3FqLQAAOgAMIAMgBCABQQx2QQ9xai0AADoACyADIAQgAUEQdkEPcWotAAA6AAogA0EGaiABQQFyZ0ECdiICaiIFQfsAOgAAIAVBf2pB9QA6AAAgA0EGaiACQX5qIgJqQdwAOgAAIAAgAykBBjcCACADQf0AOgAPIAMgBCABQQ9xai0AADoADiAAIAMvAQ47AQhBCiEBCyAAIAE6AA0gACACOgAMIANBEGokgICAgAALbAEBf0EBIQECQAJAIABB+AZJDQAgAEH+/w9JDQEgAEGBgDhGDQAgAEHg/0dqQeAASQ0AIABBgP5HakHwAUkNACAAQYCARGpB/v8DSQ0AIABBgIBAakH+/wNJIQELIAEPCyAAEMuCgIAAQQFzC+wCAQV/QQAhASOBgICAAEG028GAAGoiAiACQQBBGyAAQfzlBkkbIgMgA0ENaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EHaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EDaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0ECaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgNBAnRqKAIAQQt0IgIgAEELdCIERiACIARJaiADaiIDQQJ0aiIFKAIAQRV2IQJBtQshBAJAAkAgA0E0Sw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABBicTBgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC4kBAQJ/QQAhAQJAAkACQAJAAkAgAEEIdiICQWpqDhsABAQEBAQEBAQEAwQEBAQEBAQEBAQEBAQEBAECCyAAQYAtRiEBDAMLIABBgOAARiEBDAILIAINASODgICAACAAQf8BcWotAAAhAQwBCyODgICAACAAQf8BcWotAABBAnFBAXYhAQsgAUEBcQvsAgEFf0EAIQEjgYCAgABBjN3BgABqIgIgAkEAQRAgAEGrnQRJGyIDIANBCHIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBBHIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAnIiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQf8FIQQCQAJAIANBH0sNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQb7PwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuvAgEFf0EAIQEjgYCAgABBkN7BgABqIgIgAkEAQQYgAEGA/ANJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQSMhBAJAAkAgA0EKSw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABBvdXBgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC68CAQV/QQAhASOBgICAAEHA3sGAAGoiAiACQQBBBSAAQb2hBEkbIgMgA0EDaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgNBAnRqKAIAQQt0IgIgAEELdCIERiACIARJ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gYCAgABB1MvCgABqENCCgIAAAAsgAEEANgI8IAAgAzYCOCAAIAI2AjQgACABNgIwIABBADoADiAAQYECOwEMIAAgAjYCCCAAQgA3AwAPCyAFIAQjgYCAgABB1MvCgABqENCCgIAAAAsgDCAEI4GAgIAAQcTLwoAAahDQgoCAAAAL3gIBCH8jgICAgABBEGsiAiSAgICAAEEKIQMgACgCACIEIQUCQCAEQegHSQ0AQQohAyAEIQUDQCACQQZqIANqIgZBfGojgYCAgABB6dfBgABqIgcgBSIAIABBkM4AbiIFQZDOAGxrIghB//8DcUHkAG4iCUEBdGovAAA7AAAgBkF+aiAHIAggCUHkAGxrQf//A3FBAXRqLwAAOwAAIANBfGohAyAAQf+s4gRLDQALCwJAAkAgBUEJSw0AIAUhAAwBCyACQQZqIANBfmoiA2ojgYCAgABB6dfBgABqIAUgBUH//wNxQeQAbiIAQeQAbGtB//8DcUEBdGovAAA7AAALAkACQCAERQ0AIABFDQELIAJBBmogA0F/aiIDaiOBgICAAEHp18GAAGogAEEBdGotAAE6AAALIAFBAUEBQQAgAkEGaiADakEKIANrENWCgIAAIQMgAkEQaiSAgICAACADCxMAIAAgASACIAMgBBDdgoCAAAAL/woCBH8BfiOAgICAAEEwayIFJICAgIAAIAUgAzYCBCAFIAI2AgAgBSABNgIIAkACQAJAAkACQAJAAkACQCACIAFLIgYNACADIAFLIgcNASACIANLDQIgAkUNBCACIAFPDQQgACACaiwAAEG/f0oNBAJAIAAgAkF/aiIIaiwAAEG/f0oNACACQX5qIgMgAkF9aiAAIANqLAAAQb9/ShshCAsgASACQQFqIgMgASADSxshByACIAEgBhshAwNAAkACQCADIAJGDQAgACACaiwAAEG/f0wNAQwGCyADIAEjgYCAgABBhMzCgABqENCCgIAAAAsgAkEBaiICIAFJDQALIAchAgwDCyAFI46AgIAArUIghiIJIAVBCGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQZ+BwIAAaiAFQRhqIAQQx4KAgAAACyAFI46AgIAArUIghiIJIAVBCGqthDcDICAFIAkgBUEEaq2ENwMYI4GAgIAAQdyBwIAAaiAFQRhqIAQQx4KAgAAACyAFI46AgIAArUIghiIJIAVBBGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQbCAwIAAaiAFQRhqIAQQx4KAgAAACyAFIAg2AgwgBSACNgIQAkAgCCACSw0AIAIgAUsNAAJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAgsgAiABRg0AIAAgAmosAABBv39MDQELIAggAkYNAgJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSOagICAAK1CIIYgBUEUaq2ENwMgIAUjjoCAgACtQiCGIAWthDcDGCAFI4KAgIAAQcmAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQaiZwIAAaiAFQRhqIAQQx4KAgAAACyAAIAEgCCACIAQQ3IKAgAAACyADRQ0CIAMgAU8NAiAAIANqLAAAQb9/Sg0CAkAgACADQX9qIghqLAAAQb9/Sg0AIANBfmoiAiADQX1qIAAgAmosAABBv39KGyEICyABIANBAWoiAiABIAJLGyEGIAMgASAHGyECAkADQAJAAkAgAiADRg0AIAAgA2osAABBv39MDQEMAwsgAiABI4GAgIAAQYTMwoAAahDQgoCAAAALIANBAWoiAyABSQ0ACyAGIQMLIAUgCDYCDCAFIAM2AhAgCCADSw0BIAMgAUsNAQJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAwsgAyABRg0AIAAgA2osAABBv39MDQILIAggA0YNAAJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSOagICAAK1CIIYgBUEUaq2ENwMgIAUjjoCAgACtQiCGIAVBBGqthDcDGCAFI4KAgIAAQcmAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQfqZwIAAaiAFQRhqIAQQx4KAgAAACyAEEOCCgIAAAAsgACABIAggAyAEENyCgIAAAAsgBSOOgICAAK1CIIYiCSAFQQhqrYQ3AyAgBSAJIAVBBGqthDcDGCOBgICAAEHcgcCAAGogBUEYaiAEEMeCgIAAAAvIAQEEfyOAgICAAEEQayICJICAgIAAQQEhAwJAIAEoAgAiBEEnIAEoAgQiBSgCECIBEYSAgIAAgICAgAANACACIAAoAgBBgQIQyYKAgAACQAJAIAItAA0iA0GBAUkNACAEIAIoAgAgARGEgICAAICAgIAARQ0BQQEhAwwCCyAEIAIgAi0ADCIAaiADIABrIAUoAgwRg4CAgACAgICAAEUNAEEBIQMMAQsgBEEnIAERhICAgACAgICAACEDCyACQRBqJICAgIAAIAMLhgUBA38jgICAgABBEGsiAiSAgICAAAJAAkACQAJAIAEoAggiA0GAgIAQcQ0AIANBgICAIHENASAAIAEQ24KAgABFDQJBASEEDAMLIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQZDXwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABBkL7CgABqQQIgAkEIaiADakEIakEAIANrENWCgIAARQ0BDAILIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQZK+woAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABBkL7CgABqQQIgAkEIaiADakEIakEAIANrENWCgIAADQELI4GAgIAAIQMCQCABKAIAIANBjLzCgABqQQIgASgCBCgCDBGDgICAAICAgIAARQ0AQQEhBAwBCyAAQQRqIQMCQAJAIAEoAggiBEGAgIAQcQ0AIARBgICAIHENASADIAEQ24KAgAAhBAwCCyADKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEGQ18GAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0ACyABQQEjgYCAgABBkL7CgABqQQIgAkEIaiADakEIakEAIANrENWCgIAAIQQMAQsgAygCACEEQQAhAwNAIAJBCGogA2pBB2ojgYCAgABBkr7CgABqIARBD3FqLQAAOgAAIANBf2ohAyAEQQR2IgQN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dXQgb2YgYm91bmRzOiB0aGUgbGVuIGlzIMASIGJ1dCB0aGUgaW5kZXggaXMgwADABSwgb3IgwADABCBvciDAABFzdGFydCBieXRlIGluZGV4IMAnIGlzIG91dCBvZiBib3VuZHMgZm9yIHN0cmluZyBvZiBsZW5ndGggwAAPZW5kIGJ5dGUgaW5kZXggwCcgaXMgb3V0IG9mIGJvdW5kcyBmb3Igc3RyaW5nIG9mIGxlbmd0aCDAABJyYW5nZSBzdGFydCBpbmRleCDAIiBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDAABByYW5nZSBlbmQgaW5kZXggwCIgb3V0IG9mIHJhbmdlIGZvciBzbGljZSBvZiBsZW5ndGggwAALdW5leHBlY3RlZCDAAAt1bmV4cGVjdGVkIMALOyBleHBlY3RlZCDAAAlleHBlY3RlZCDAABBhc3NlcnRpb24gYGxlZnQgwBcgcmlnaHRgIGZhaWxlZAogIGxlZnQ6IMAJCiByaWdodDogwAAQYXNzZXJ0aW9uIGBsZWZ0IMAQIHJpZ2h0YCBmYWlsZWQ6IMAJCiAgbGVmdDogwAkKIHJpZ2h0OiDAABVtZXJtYWlkIHBhcnNlIGVycm9yOiDAAMACOiDAAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvaW8vZXJyb3IvdW5peC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pbmRleC5ycwAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE3LjEvc3JjL3Jhdy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc2hhcmVkL3NtYWxsc29ydC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3N0YWJsZS9xdWlja3NvcnQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlycy5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvdHlwZXMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL211dGV4L25vX3RocmVhZHMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL3J3bG9jay9ub190aHJlYWRzLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy9zdHIucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvZXJyb3IucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvaXRlcmF0b3JzL3BhaXIucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tZW1jaHIucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9udW0vaW1wL2RlYzJmbHQvZGVjaW1hbF9zZXEucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvc3RyL3BhdHRlcm4ucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zdHIvcGF0dGVybi5ycwAvbW50L3dvcmsvcnVubmVyLXNoYXJlZC9jYXJnby1ob21lL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9wZXN0LTIuOS42L3NyYy9wb3NpdGlvbi5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vd3JpdGUucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvcGFyc2VyX3N0YXRlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvbnVtL2ltcC9kZWMyZmx0L3BhcnNlLnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC9waWUucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL3NlcXVlbmNlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zdHIvbW9kLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMvbW9kLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvaWQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS9yZXByX2lvdmVjLnJzAMABOgAvABFzdGFydCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAPZW5kIGJ5dGUgaW5kZXggwCYgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlIMAIIChieXRlcyDACyBvZiBzdHJpbmcpABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDARyBieXRlcyBmYWlsZWQKc2tpcHBpbmcgYmFja3RyYWNlIHByaW50aW5nIHRvIGF2b2lkIHBvdGVudGlhbCByZWN1cnNpb24KADVmYXRhbCBydW50aW1lIGVycm9yOiBmYWlsZWQgdG8gaW5pdGlhdGUgcGFuaWMsIGVycm9yIMALLCBhYm9ydGluZwoAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMAOIGJ5dGVzIGZhaWxlZAoADHBhbmlja2VkIGF0IMACOgrAMwp0aHJlYWQgcGFuaWNrZWQgd2hpbGUgcHJvY2Vzc2luZyBwYW5pYy4gYWJvcnRpbmcuCgAJCnRocmVhZCAnwAMnICjADikgcGFuaWNrZWQgYXQgwAI6CsABCgAZYWJvcnRpbmcgZHVlIHRvIHBhbmljIGF0IMACOgrAAQoAdW5rbm93biBwYXJzaW5nIGVycm9yaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZWZhdGFsIHJ1bnRpbWUgZXJyb3I6IEF0dGVtcHRlZCB0byBpbml0aWFsaXplIHRocmVhZC1sb2NhbCB3aGlsZSBpdCBpcyBiZWluZyBkcm9wcGVkLCBhYm9ydGluZwr//////////2F0dGVtcHQgdG8gam9pbiBpbnRvIGNvbGxlY3Rpb24gd2l0aCBsZW4gPiB1c2l6ZTo6TUFYY2FsbCBsaW1pdCByZWFjaGVkc3RhY2sgbGltaXQgcmVhY2hlZFREQlRMUlJMcmVjdHJvdW5kZWRkaWFtb25kY2lyY2xlaWRsYWJlbHNoYXBlYXJyb3dsaW5lc291cmNldGFyZ2V0ZWRnZVR5cGVraW5kdmFyaWFudGRpcmVjdGlvbm5vZGVzZWRnZXNwYXJ0aWNpcGFudHNtZXNzYWdlc2Zyb210b3RleHRhcnJvd19raW5kU29saWREb3R0ZWRTb2xpZE9wZW5Eb3R0ZWRPcGVudGl0bGVzbGljZXNzZWN0aW9uc25hbWV0YXNrc2RlcHNkdXJhdGlvbkFueURpYWdyYW1HcmFwaGdyYXBoUGllcGllR2FudHRnYW50dFNlcXVlbmNlc2VxdWVuY2UtLT5mbG93Y2hhcnRtaWQgPiBsZW5wb3NpdGlvbiBvdXQgb2YgYm91bmRzwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrTIAAAaAQAAyB8IMABCsgAAAMgfCDICAABCsgAAAMgfArIAAADID0gyAkAAEZvcm1hdHRpbmcgYXJndW1lbnQgb3V0IG9mIHJhbmdlwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrIAAAHIHwgLi4uCtsgAABoBAAGAAMgfCDAAQrIAAADIHwgyAgAAQrIAAADIHwKyAAAAyA9IMgJAADABC0tPiDAwAE6wAEKyAAAAyB8CsgCAAMgfCDIBAABCsgAAAMgfCDIBQABCsgAAAMgfArIAAADID0gyAYAAC0+Pi0tPj4tPgAAAQAAAAAAAABFT0lmaWxlZGlhZ3JhbWt3c3RtdHNzdG10c3RtdF9pbm5lcmNvbW1lbnRjaGFpbm5vZGVkZWZucmVmbmlkY2lyY3JuZGRpYW1zdHh0ZWRnZWFycl9sYmxhcnJsbl9sYmxsbmxibGx0eHRzcG5sZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcgAAAAMEBwIJBQQKBwUHBAMFBAQDBAQEBwMGAgMEAgJ1dXV1dXV1dWJ0bnVmcnV1dXV1dXV1dXV1dXV1dXV1dQAAIgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDEyMzQ1Njc4OWFiY2RlZgAAAAAAAAAAAAAAAAAAAAAFBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBWUtMzI0AAUAZS0zMjMABQBlLTMyMgAFAGUtMzIxAAUAZS0zMjAABQBlLTMxOQAFAGUtMzE4AAUAZS0zMTcABQBlLTMxNgAFAGUtMzE1AAUAZS0zMTQABQBlLTMxMwAFAGUtMzEyAAUAZS0zMTEABQBlLTMxMAAFAGUtMzA5AAUAZS0zMDgABQBlLTMwNwAFAGUtMzA2AAUAZS0zMDUABQBlLTMwNAAFAGUtMzAzAAUAZS0zMDIABQBlLTMwMQAFAGUtMzAwAAUAZS0yOTkABQBlLTI5OAAFAGUtMjk3AAUAZS0yOTYABQBlLTI5NQAFAGUtMjk0AAUAZS0yOTMABQBlLTI5MgAFAGUtMjkxAAUAZS0yOTAABQBlLTI4OQAFAGUtMjg4AAUAZS0yODcABQBlLTI4NgAFAGUtMjg1AAUAZS0yODQABQBlLTI4MwAFAGUtMjgyAAUAZS0yODEABQBlLTI4MAAFAGUtMjc5AAUAZS0yNzgABQBlLTI3NwAFAGUtMjc2AAUAZS0yNzUABQBlLTI3NAAFAGUtMjczAAUAZS0yNzIABQBlLTI3MQAFAGUtMjcwAAUAZS0yNjkABQBlLTI2OAAFAGUtMjY3AAUAZS0yNjYABQBlLTI2NQAFAGUtMjY0AAUAZS0yNjMABQBlLTI2MgAFAGUtMjYxAAUAZS0yNjAABQBlLTI1OQAFAGUtMjU4AAUAZS0yNTcABQBlLTI1NgAFAGUtMjU1AAUAZS0yNTQABQBlLTI1MwAFAGUtMjUyAAUAZS0yNTEABQBlLTI1MAAFAGUtMjQ5AAUAZS0yNDgABQBlLTI0NwAFAGUtMjQ2AAUAZS0yNDUABQBlLTI0NAAFAGUtMjQzAAUAZS0yNDIABQBlLTI0MQAFAGUtMjQwAAUAZS0yMzkABQBlLTIzOAAFAGUtMjM3AAUAZS0yMzYABQBlLTIzNQAFAGUtMjM0AAUAZS0yMzMABQBlLTIzMgAFAGUtMjMxAAUAZS0yMzAABQBlLTIyOQAFAGUtMjI4AAUAZS0yMjcABQBlLTIyNgAFAGUtMjI1AAUAZS0yMjQABQBlLTIyMwAFAGUtMjIyAAUAZS0yMjEABQBlLTIyMAAFAGUtMjE5AAUAZS0yMTgABQBlLTIxNwAFAGUtMjE2AAUAZS0yMTUABQBlLTIxNAAFAGUtMjEzAAUAZS0yMTIABQBlLTIxMQAFAGUtMjEwAAUAZS0yMDkABQBlLTIwOAAFAGUtMjA3AAUAZS0yMDYABQBlLTIwNQAFAGUtMjA0AAUAZS0yMDMABQBlLTIwMgAFAGUtMjAxAAUAZS0yMDAABQBlLTE5OQAFAGUtMTk4AAUAZS0xOTcABQBlLTE5NgAFAGUtMTk1AAUAZS0xOTQABQBlLTE5MwAFAGUtMTkyAAUAZS0xOTEABQBlLTE5MAAFAGUtMTg5AAUAZS0xODgABQBlLTE4NwAFAGUtMTg2AAUAZS0xODUABQBlLTE4NAAFAGUtMTgzAAUAZS0xODIABQBlLTE4MQAFAGUtMTgwAAUAZS0xNzkABQBlLTE3OAAFAGUtMTc3AAUAZS0xNzYABQBlLTE3NQAFAGUtMTc0AAUAZS0xNzMABQBlLTE3MgAFAGUtMTcxAAUAZS0xNzAABQBlLTE2OQAFAGUtMTY4AAUAZS0xNjcABQBlLTE2NgAFAGUtMTY1AAUAZS0xNjQABQBlLTE2MwAFAGUtMTYyAAUAZS0xNjEABQBlLTE2MAAFAGUtMTU5AAUAZS0xNTgABQBlLTE1NwAFAGUtMTU2AAUAZS0xNTUABQBlLTE1NAAFAGUtMTUzAAUAZS0xNTIABQBlLTE1MQAFAGUtMTUwAAUAZS0xNDkABQBlLTE0OAAFAGUtMTQ3AAUAZS0xNDYABQBlLTE0NQAFAGUtMTQ0AAUAZS0xNDMABQBlLTE0MgAFAGUtMTQxAAUAZS0xNDAABQBlLTEzOQAFAGUtMTM4AAUAZS0xMzcABQBlLTEzNgAFAGUtMTM1AAUAZS0xMzQABQBlLTEzMwAFAGUtMTMyAAUAZS0xMzEABQBlLTEzMAAFAGUtMTI5AAUAZS0xMjgABQBlLTEyNwAFAGUtMTI2AAUAZS0xMjUABQBlLTEyNAAFAGUtMTIzAAUAZS0xMjIABQBlLTEyMQAFAGUtMTIwAAUAZS0xMTkABQBlLTExOAAFAGUtMTE3AAUAZS0xMTYABQBlLTExNQAFAGUtMTE0AAUAZS0xMTMABQBlLTExMgAFAGUtMTExAAUAZS0xMTAABQBlLTEwOQAFAGUtMTA4AAUAZS0xMDcABQBlLTEwNgAFAGUtMTA1AAUAZS0xMDQABQBlLTEwMwAFAGUtMTAyAAUAZS0xMDEABQBlLTEwMAAFAGUtOTkAAAQAZS05OAAABABlLTk3AAAEAGUtOTYAAAQAZS05NQAABABlLTk0AAAEAGUtOTMAAAQAZS05MgAABABlLTkxAAAEAGUtOTAAAAQAZS04OQAABABlLTg4AAAEAGUtODcAAAQAZS04NgAABABlLTg1AAAEAGUtODQAAAQAZS04MwAABABlLTgyAAAEAGUtODEAAAQAZS04MAAABABlLTc5AAAEAGUtNzgAAAQAZS03NwAABABlLTc2AAAEAGUtNzUAAAQAZS03NAAABABlLTczAAAEAGUtNzIAAAQAZS03MQAABABlLTcwAAAEAGUtNjkAAAQAZS02OAAABABlLTY3AAAEAGUtNjYAAAQAZS02NQAABABlLTY0AAAEAGUtNjMAAAQAZS02MgAABABlLTYxAAAEAGUtNjAAAAQAZS01OQAABABlLTU4AAAEAGUtNTcAAAQAZS01NgAABABlLTU1AAAEAGUtNTQAAAQAZS01MwAABABlLTUyAAAEAGUtNTEAAAQAZS01MAAABABlLTQ5AAAEAGUtNDgAAAQAZS00NwAABABlLTQ2AAAEAGUtNDUAAAQAZS00NAAABABlLTQzAAAEAGUtNDIAAAQAZS00MQAABABlLTQwAAAEAGUtMzkAAAQAZS0zOAAABABlLTM3AAAEAGUtMzYAAAQAZS0zNQAABABlLTM0AAAEAGUtMzMAAAQAZS0zMgAABABlLTMxAAAEAGUtMzAAAAQAZS0yOQAABABlLTI4AAAEAGUtMjcAAAQAZS0yNgAABABlLTI1AAAEAGUtMjQAAAQAZS0yMwAABABlLTIyAAAEAGUtMjEAAAQAZS0yMAAABABlLTE5AAAEAGUtMTgAAAQAZS0xNwAABABlLTE2AAAEAGUtMTUAAAQAZS0xNAAABABlLTEzAAAEAGUtMTIAAAQAZS0xMQAABABlLTEwAAAEAGUtOQAAAAMAZS04AAAAAwBlLTcAAAADAGUtNgAAAAMAZS01AAAAAwBlLTQAAAADAGUtMwAAAAMAZS0yAAAAAwBlLTEAAAADAGUrMAAAAAMAZSsxAAAAAwBlKzIAAAADAGUrMwAAAAMAZSs0AAAAAwBlKzUAAAADAGUrNgAAAAMAZSs3AAAAAwBlKzgAAAADAGUrOQAAAAMAZSsxMAAABABlKzExAAAEAGUrMTIAAAQAZSsxMwAABABlKzE0AAAEAGUrMTUAAAQAZSsxNgAABABlKzE3AAAEAGUrMTgAAAQAZSsxOQAABABlKzIwAAAEAGUrMjEAAAQAZSsyMgAABABlKzIzAAAEAGUrMjQAAAQAZSsyNQAABABlKzI2AAAEAGUrMjcAAAQAZSsyOAAABABlKzI5AAAEAGUrMzAAAAQAZSszMQAABABlKzMyAAAEAGUrMzMAAAQAZSszNAAABABlKzM1AAAEAGUrMzYAAAQAZSszNwAABABlKzM4AAAEAGUrMzkAAAQAZSs0MAAABABlKzQxAAAEAGUrNDIAAAQAZSs0MwAABABlKzQ0AAAEAGUrNDUAAAQAZSs0NgAABABlKzQ3AAAEAGUrNDgAAAQAZSs0OQAABABlKzUwAAAEAGUrNTEAAAQAZSs1MgAABABlKzUzAAAEAGUrNTQAAAQAZSs1NQAABABlKzU2AAAEAGUrNTcAAAQAZSs1OAAABABlKzU5AAAEAGUrNjAAAAQAZSs2MQAABABlKzYyAAAEAGUrNjMAAAQAZSs2NAAABABlKzY1AAAEAGUrNjYAAAQAZSs2NwAABABlKzY4AAAEAGUrNjkAAAQAZSs3MAAABABlKzcxAAAEAGUrNzIAAAQAZSs3MwAABABlKzc0AAAEAGUrNzUAAAQAZSs3NgAABABlKzc3AAAEAGUrNzgAAAQAZSs3OQAABABlKzgwAAAEAGUrODEAAAQAZSs4MgAABABlKzgzAAAEAGUrODQAAAQAZSs4NQAABABlKzg2AAAEAGUrODcAAAQAZSs4OAAABABlKzg5AAAEAGUrOTAAAAQAZSs5MQAABABlKzkyAAAEAGUrOTMAAAQAZSs5NAAABABlKzk1AAAEAGUrOTYAAAQAZSs5NwAABABlKzk4AAAEAGUrOTkAAAQAZSsxMDAABQBlKzEwMQAFAGUrMTAyAAUAZSsxMDMABQBlKzEwNAAFAGUrMTA1AAUAZSsxMDYABQBlKzEwNwAFAGUrMTA4AAUAZSsxMDkABQBlKzExMAAFAGUrMTExAAUAZSsxMTIABQBlKzExMwAFAGUrMTE0AAUAZSsxMTUABQBlKzExNgAFAGUrMTE3AAUAZSsxMTgABQBlKzExOQAFAGUrMTIwAAUAZSsxMjEABQBlKzEyMgAFAGUrMTIzAAUAZSsxMjQABQBlKzEyNQAFAGUrMTI2AAUAZSsxMjcABQBlKzEyOAAFAGUrMTI5AAUAZSsxMzAABQBlKzEzMQAFAGUrMTMyAAUAZSsxMzMABQBlKzEzNAAFAGUrMTM1AAUAZSsxMzYABQBlKzEzNwAFAGUrMTM4AAUAZSsxMzkABQBlKzE0MAAFAGUrMTQxAAUAZSsxNDIABQBlKzE0MwAFAGUrMTQ0AAUAZSsxNDUABQBlKzE0NgAFAGUrMTQ3AAUAZSsxNDgABQBlKzE0OQAFAGUrMTUwAAUAZSsxNTEABQBlKzE1MgAFAGUrMTUzAAUAZSsxNTQABQBlKzE1NQAFAGUrMTU2AAUAZSsxNTcABQBlKzE1OAAFAGUrMTU5AAUAZSsxNjAABQBlKzE2MQAFAGUrMTYyAAUAZSsxNjMABQBlKzE2NAAFAGUrMTY1AAUAZSsxNjYABQBlKzE2NwAFAGUrMTY4AAUAZSsxNjkABQBlKzE3MAAFAGUrMTcxAAUAZSsxNzIABQBlKzE3MwAFAGUrMTc0AAUAZSsxNzUABQBlKzE3NgAFAGUrMTc3AAUAZSsxNzgABQBlKzE3OQAFAGUrMTgwAAUAZSsxODEABQBlKzE4MgAFAGUrMTgzAAUAZSsxODQABQBlKzE4NQAFAGUrMTg2AAUAZSsxODcABQBlKzE4OAAFAGUrMTg5AAUAZSsxOTAABQBlKzE5MQAFAGUrMTkyAAUAZSsxOTMABQBlKzE5NAAFAGUrMTk1AAUAZSsxOTYABQBlKzE5NwAFAGUrMTk4AAUAZSsxOTkABQBlKzIwMAAFAGUrMjAxAAUAZSsyMDIABQBlKzIwMwAFAGUrMjA0AAUAZSsyMDUABQBlKzIwNgAFAGUrMjA3AAUAZSsyMDgABQBlKzIwOQAFAGUrMjEwAAUAZSsyMTEABQBlKzIxMgAFAGUrMjEzAAUAZSsyMTQABQBlKzIxNQAFAGUrMjE2AAUAZSsyMTcABQBlKzIxOAAFAGUrMjE5AAUAZSsyMjAABQBlKzIyMQAFAGUrMjIyAAUAZSsyMjMABQBlKzIyNAAFAGUrMjI1AAUAZSsyMjYABQBlKzIyNwAFAGUrMjI4AAUAZSsyMjkABQBlKzIzMAAFAGUrMjMxAAUAZSsyMzIABQBlKzIzMwAFAGUrMjM0AAUAZSsyMzUABQBlKzIzNgAFAGUrMjM3AAUAZSsyMzgABQBlKzIzOQAFAGUrMjQwAAUAZSsyNDEABQBlKzI0MgAFAGUrMjQzAAUAZSsyNDQABQBlKzI0NQAFAGUrMjQ2AAUAZSsyNDcABQBlKzI0OAAFAGUrMjQ5AAUAZSsyNTAABQBlKzI1MQAFAGUrMjUyAAUAZSsyNTMABQBlKzI1NAAFAGUrMjU1AAUAZSsyNTYABQBlKzI1NwAFAGUrMjU4AAUAZSsyNTkABQBlKzI2MAAFAGUrMjYxAAUAZSsy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ZCB0aGVpciBsZW5ndGgAQm94PGR5biBBbnk+dGhyZWFkIGNhdXNlZCBub24tdW53aW5kaW5nIHBhbmljLiBhYm9ydGluZy4Kc3RhY2sgYmFja3RyYWNlOgpub3RlOiBTb21lIGRldGFpbHMgYXJlIG9taXR0ZWQsIHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT1mdWxsYCBmb3IgYSB2ZXJib3NlIGJhY2t0cmFjZS4KZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcnN0cmVycm9yX3IgZmFpbHVyZWZhaWxlZCB0byBnZW5lcmF0ZSB1bmlxdWUgdGhyZWFkIElEOiBiaXRzcGFjZSBleGhhdXN0ZWRyd2xvY2sgaGFzIG5vdCBiZWVuIGxvY2tlZCBmb3IgcmVhZGluZyIBCAkrDSsrKxwrKwYCAx4rKxoMKxsEKysnIxQpKw8SKCArKyEKKwUoKysAKysrJisrGCQHDhArKyQrKysrAQsrKysrERkrExYdH0hhc2ggdGFibGUgY2FwYWNpdHkgb3ZlcmZsb3dTdWNjZXNzAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAE5vIHN1Y2ggZGV2aWNlAE5vdCBhIGRpcmVjdG9yeQBJcyBhIGRpcmVjdG9yeQBUZXh0IGZpbGUgYnVzeQBFeGVjIGZvcm1hdCBlcnJvcgBJbnZhbGlkIGFyZ3VtZW50AEFyZ3VtZW50IGxpc3QgdG9vIGxvbmcAU3ltYm9saWMgbGluayBsb29wAEZpbGVuYW1lIHRvbyBsb25nAFRvbyBtYW55IG9wZW4gZmlsZXMgaW4gc3lzdGVtAE5vIGZpbGUgZGVzY3JpcHRvcnMgYXZhaWxhYmxlAEJhZCBmaWxlIGRlc2NyaXB0b3IATm8gY2hpbGQgcHJvY2VzcwBCYWQgYWRkcmVzcwBGaWxlIHRvbyBsYXJnZQBUb28gbWFueSBsaW5rcwBObyBsb2NrcyBhdmFpbGFibGUAUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIAU3RhdGUgbm90IHJlY292ZXJhYmxlAFByZXZpb3VzIG93bmVyIGRpZWQAT3BlcmF0aW9uIGNhbmNlbGVkAEZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZABObyBtZXNzYWdlIG9mIGRlc2lyZWQgdHlwZQBJZGVudGlmaWVyIHJlbW92ZWQATGluayBoYXMgYmVlbiBzZXZlcmVkAFByb3RvY29sIGVycm9yAEJhZCBtZXNzYWdlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUXVvdGEgZXhjZWVkZWQATXVsdGlob3AgYXR0ZW1wdGVkAENhcGFiaWxpdGllcyBpbnN1ZmZpY2llbnQAAAAAAAAAAAAAAAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gXvv71jYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90RXJyb3ICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIGBAcBAQEUAQABJgIyAgMBNwgbBAYLAAE8AmUOOwIxAg8BHAIBAQsFIgXtAQgCAgIWAQcBAQMEAgkCAgIECAEEAgEFAhkCAwEGBAICFgEHAQIBAgECAgEBBQQCAgMDAQcEAQEHEQoDAQkBAwEWAQcBAgEFAgoBAwEDAgEPBAIMBwcBAwEIAgICFgEHAQIBBQIJAgICAwcDBAIBBQISCgIBBgMDAQQDAgEBAQIDAgMDAwwEBQMDAQQCAQYBDhUFDQEDARcBEAIJAQMBBAcCAQMBAgIEAgoHFgEDARcBCgEFAgkBAwEEBwIFAwEEAgoBAwwNAQMBMwEDAQYEEAIaAQMBEgMYAQkBAQIHAwEEBgEBAQgGCgIDDDoEHSUCAQEBBQEYAQEBFwIFAQEBBwEKAgQgSAEkBCcBJAEPAQ0lxgEBBQECAAEEAgcBAQEEAikBBAIhAQQCBwEBAQQCDwE5AQQCQwIgAxoGVgIGAgADWQcWCRgJFAwNAQMBAgxeAgoGCgYaBlkHKwVGCh8BDAQMBAEDKgIFCywEGgYLAz4CQQEdAgsGCgYOAi4CDBRNAaYIPAMPAz4FKwILCCsFAAIGAiYCBgIIAQEBAQEBAR8CNQEPAQ4CBgETAgMBCQFlAQwCGwENAyIOIQ+MBAAWCxUAAgAFLQEBBQECOAcCDhgJBwEHAQcBBwEHAQcBBwEHAX4iGgFZDNYaUAFWAmcFKwFeAVYJMAEAAzcJABS4CN0UPAMKBjgIRggMBnQLHgNOAQsEIQE3CQ4CCgJnGBwKBgIGAgYJBwEHATwEfgIKBgAMFwQxBAACaiYHDAUFGgEFAQEBAgECAQAgKgYzARMBBAQFAYcCAQG+AwYCBgIGAgMDBwEHCgUCDAEaARMBAgEPAg4iewUDBC0DWAENAwEvLoIdAzEPHAQkCR4FKwUeASUEDiqeAgoGJAQkBCgINAsMAQ8BBwECAQsBDwEHAQIDNAwACRYKCBgGASoBCUUGAgEBLAECAwECFwFICAkwEwECBSEDGwUbJjgEFAIyAQIFCAEDAR0CAwQKBwkHQCAnBAwJNgMdAhsFGgcEDAdQSTczDTMHLggKBiYDHQgC0B8BKgEDAgIQBggJIS4IKhYaJhwUFwlOBCQJRAoBAhkHCgY1ARIIJwlgARQLEgEvPgcBAQEEAQ8BCwY7BQoGBAEIAgICFgEHAQIBBQEKAgICAwIBBgEFBwIHAwULCgEBAgEBJgEKAQECAQEEAQoBAggCHVwBBR5ICAqmNgImIkULCgYNEzoGCgYUHBsCDwQXuTxkUwwIAgECCAECAR4BAgIMCQpGCAIuAgsbSAhTDUkHClYIWCIOCgYJAS0BDgodAyACFgEOSQcBAgEsAwEBAgEJCAoGBgECASUBAgEGBwoGLAQK9hkHEQEpAx1VAQ8yDQBmbwEFC8QAYw0ACgAFAAA6AAAHHwEKBFEBCgYeAgYK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CQABAQYBAQkDCAQHBgUGAgUHBAUABQgABQkGCQIDCAIIAQIFAwcCBQIJAAIJCAQGAQkBBAAGAgUBCAYCBgQFAQQJAgMACQUHAAMBAgUJAwEDAgIFBwQGAQUEBwgFAQUGAgUEBgUGBgECCAcDAAcHAwkCBQcIAQIFAgMCCAMABgQDBgUDCAYJBgIICQAGAgUBAQYEAQUDAgEIAgYJAwQIAQQEBQMBAgUFCAIABwYGAAkBAwQGBwQABwICBgUGAgUCCQEAAwgDAAQFBgcDAwcAAwYBAwIIAQIFAQQFBQEJAQUCAggDBgYIBQEIAAYGBAAGAgUHAgcFCQUHBgEEAQgDBAIFCQADAwIAAwECBQMGAwcJBwgIAAcACQEHAQIJBQEGBgABBQYCBQEIAQgJCAkEAAMFBAUIBQYEBwUIAwAABwgBAgUJAAkECQQHAAEHBwIJAggCAwcJAQUAAwkABgIFBAUEBwQHAwUACAgGBAYEAQEICQUHBQEJBQMBAgUCAgcDBwMGBwUEBAMCAwIABQkEBwgHBQkHBgUGAgUBAQMGCAYIAwcHAgEGAQYAAgkHAwkDBwkICAIIAQIFBQYIBAMEAQgIBgAIAAgAAQQIBgkGCAkJBAEEAAYCBQIIBAIBBwAJBAMABAAEAAAHBAMECAQECQcABwADAQIFAQQCAQAIBQQHAQUCAAIAAAMHAQcEAgIECAUDBQEFBgIFBwEABQQCBwMFBwYAAQAAAQgFCAcBAQIEAgYHBQcIAQIFAwUFAgcBAwYHCAgAAAUAAAkCCQMFBQYCAQMDBwgJAAYCBQEHBwYDBQYIAwkEAAACBQAEBgQGBwcIAQAGBggJBAUDAQIFCAgIAQcIBAEJBwAAAQIFAgMCAwMICQAFAwMEBAcCBgUGAgUEBAQACAkCAAkIBQAABgIGAQYBBgkEBQIGBgcCAwYDAggBAgUCAgIABAQGAAQJAgUAAwEDAAgACAQHAgYDAwMGAQgBBgQABgIFAQEBAAICAwACBAYCBQEFBgUEAAQCAwYDAQYGCAAJAAgCAAMBAgUFBQUBAQEFAQIDAQIFBwgCBwACAQEIAQUIAwQABAUEAQABBQYCBQIHBwUFBQcFBgEFBgIICQEDBQEABQkABwkBBwACAgcABQAHCAECBQEDCAcHBwgHCAAHCAEEBAUGBwUFAgkFAwkFCAUBAQMFAgUDCQAG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");
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
