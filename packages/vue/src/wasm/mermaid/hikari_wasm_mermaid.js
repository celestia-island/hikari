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
const __jcoEmbeddedRuntime$toUint32 = (context, value) => {
	context.strict && !__jcoEmbeddedRuntime$isUint32(value) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u32", value);
	return value >>> 0;
};
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
const __jcoEmbeddedRuntime$coinFlip = () => Math.random() > .5;
const __jcoEmbeddedRuntime$base64Compile = (context, encoded) => {
	let host = globalThis;
	return context.WebAssembly.compile(context.nodejsCompat && host.Buffer !== void 0 ? host.Buffer.from(encoded, "base64") : Uint8Array.from(atob(encoded), (byte) => byte.charCodeAt(0)));
};
const __jcoEmbeddedRuntime$instantiateCore = (platform, module, imports) => platform.instantiate(module, imports);
const __jcoEmbeddedRuntime$clampGuest = (value, min, max) => {
	if (value < min || value > max) throw TypeError(`must be between ${min} and ${max}`);
	return value;
};
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
function __jcoEmbeddedRuntime$lowerFlatRecord(meta) {
	let { fieldMetas, size32: recordSize32, align32: recordAlign32 } = meta;
	return function lowerFlatRecordInner(ctx) {
		__jcoEmbeddedRuntime$debugLog("[_lowerFlatRecord()] args", { ctx });
		let originalPtr = ctx.storagePtr;
		let r = ctx.vals[0];
		for (let [tag, lowerFn, size32, align32] of fieldMetas) {
			let rem = ctx.storagePtr % align32;
			rem !== 0 && (ctx.storagePtr += align32 - rem);
			let fieldPtr = ctx.storagePtr;
			ctx.vals = [r[tag]];
			lowerFn(ctx);
			ctx.storagePtr = Math.max(ctx.storagePtr, fieldPtr + size32);
		}
		ctx.storagePtr = Math.max(ctx.storagePtr, originalPtr + recordSize32);
		let rem = ctx.storagePtr % recordAlign32;
		rem !== 0 && (ctx.storagePtr += recordAlign32 - rem);
	};
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
const toUint32 = __jcoEmbeddedRuntime$toUint32;
const toUint64 = __jcoEmbeddedRuntime$toUint64;
const base64Compile = __jcoEmbeddedRuntime$base64Compile;
const clampGuest = __jcoEmbeddedRuntime$clampGuest;
const _clearCurrentTask = __jcoEmbeddedRuntime$clearCurrentTaskMeta;
const _debugLog = __jcoEmbeddedRuntime$debugLog;
const _getGlobalCurrentThreadMeta = __jcoEmbeddedRuntime$getCurrentTaskMeta;
const getErrorPayload = __jcoEmbeddedRuntime$getErrorPayload;
const _jcoInitializeAsyncDeterminism = __jcoEmbeddedRuntime$initializeAsyncDeterminism;
const _jcoInitializeAsyncEventCodes = __jcoEmbeddedRuntime$initializeAsyncEventCodes;
const _jcoInitializeComponentMemoryMap = __jcoEmbeddedRuntime$initializeComponentMemoryMap;
const _jcoInitializeEndianness = __jcoEmbeddedRuntime$initializeEndianness;
const _jcoInitializeHasOwnProperty = __jcoEmbeddedRuntime$initializeHasOwnProperty;
const _jcoInitializeRepTableClass = __jcoEmbeddedRuntime$initializeRepTableClass;
const _jcoInitializeRuntimeErrorConstructor = __jcoEmbeddedRuntime$initializeRuntimeErrorConstructor;
const _jcoInitializeSymbolCabiDispose = __jcoEmbeddedRuntime$initializeSymbolCabiDispose;
const _jcoInitializeSymbolDispose = __jcoEmbeddedRuntime$initializeSymbolDispose;
const _jcoInitializeSymbolResourceHandle = __jcoEmbeddedRuntime$initializeSymbolResourceHandle;
const _jcoInitializeSymbolResourceRep = __jcoEmbeddedRuntime$initializeSymbolResourceRep;
const _jcoInitializeTaskRegisters = __jcoEmbeddedRuntime$initializeTaskRegisters;
const instantiateCore = __jcoEmbeddedRuntime$instantiateCore;
const _setGlobalCurrentThreadMeta = __jcoEmbeddedRuntime$setCurrentTaskMeta;
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
const _lowerFlatRecord = __jcoEmbeddedRuntime$lowerFlatRecord;
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
import { monotonicClock, wallClock } from "@bytecodealliance/preview2-shim/clocks";
import { error, poll as poll$1, streams } from "@bytecodealliance/preview2-shim/io";
import { insecureSeed as insecureSeed$1 } from "@bytecodealliance/preview2-shim/random";
const { getEnvironment } = environment;
if (getEnvironment === void 0) {
	let err = Error("unexpectedly undefined local import 'getEnvironment', was 'getEnvironment' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { exit, exitWithCode } = exit$1;
if (exit === void 0) {
	let err = Error("unexpectedly undefined local import 'exit', was 'exit' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
if (exitWithCode === void 0) {
	let err = Error("unexpectedly undefined local import 'exitWithCode', was 'exitWithCode' available at instantiation?");
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
const { now, subscribeDuration } = monotonicClock;
if (now === void 0) {
	let err = Error("unexpectedly undefined local import 'now', was 'now' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
if (subscribeDuration === void 0) {
	let err = Error("unexpectedly undefined local import 'subscribeDuration', was 'subscribeDuration' available at instantiation?");
	console.error("ERROR:", err.toString());
	throw err;
}
const { now: now$1 } = wallClock;
if (now$1 === void 0) {
	let err = Error("unexpectedly undefined local import 'now$1', was 'now' available at instantiation?");
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
const _trampoline7 = function(arg0) {
	_debugLog("[iface=\"wasi:cli/exit@0.2.12\", function=\"exit-with-code\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "exitWithCode",
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
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => exitWithCode(clampGuest(arg0, 0, 255)))
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
	_debugLog("[iface=\"wasi:cli/exit@0.2.12\", function=\"exit-with-code\"][Instruction::Return]", {
		funcName: "exit-with-code",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline7.fnName = "wasi:cli/exit@0.2.12#exitWithCode";
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
const _trampoline8 = function(arg0) {
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
_trampoline8.fnName = "wasi:io/poll@0.2.12#block";
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
const _trampoline9 = function(arg0) {
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
_trampoline9.fnName = "wasi:io/streams@0.2.12#subscribe";
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
const _trampoline10 = function() {
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
_trampoline10.fnName = "wasi:cli/stdin@0.2.12#getStdin";
const _trampoline11 = function() {
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
_trampoline11.fnName = "wasi:cli/stdout@0.2.12#getStdout";
const _trampoline12 = function() {
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
_trampoline12.fnName = "wasi:cli/stderr@0.2.12#getStderr";
const _trampoline13 = function() {
	_debugLog("[iface=\"wasi:clocks/monotonic-clock@0.2.12\", function=\"now\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "now",
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
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => now())
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
	_debugLog("[iface=\"wasi:clocks/monotonic-clock@0.2.12\", function=\"now\"][Instruction::Return]", {
		funcName: "now",
		paramCount: 1,
		async: !1,
		postReturn: !1
	});
	task.resolve([toUint64(_jcoStrictNumericContext, ret)]);
	task.exit();
	return toUint64(_jcoStrictNumericContext, ret);
};
_trampoline13.fnName = "wasi:clocks/monotonic-clock@0.2.12#now";
const _trampoline14 = function(arg0) {
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
_trampoline14.fnName = "wasi:clocks/monotonic-clock@0.2.12#subscribeDuration";
let exports1;
let memory0;
let realloc0;
const _trampoline15 = function(arg0) {
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
_trampoline15.fnName = "wasi:random/insecure-seed@0.2.12#insecureSeed";
const _trampoline16 = function(arg0, arg1, arg2) {
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
_trampoline16.fnName = "wasi:io/poll@0.2.12#poll";
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
_trampoline17.fnName = "wasi:io/streams@0.2.12#checkWrite";
const _trampoline18 = function(arg0, arg1, arg2, arg3) {
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
_trampoline18.fnName = "wasi:io/streams@0.2.12#write";
const _trampoline19 = function(arg0, arg1) {
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
_trampoline19.fnName = "wasi:io/streams@0.2.12#blockingFlush";
const _trampoline20 = function(arg0) {
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
_trampoline20.fnName = "wasi:cli/environment@0.2.12#getEnvironment";
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
const _trampoline21 = function(arg0) {
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
_trampoline21.fnName = "wasi:cli/terminal-stdin@0.2.12#getTerminalStdin";
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
const _trampoline22 = function(arg0) {
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
_trampoline22.fnName = "wasi:cli/terminal-stdout@0.2.12#getTerminalStdout";
const _trampoline23 = function(arg0) {
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
_trampoline23.fnName = "wasi:cli/terminal-stderr@0.2.12#getTerminalStderr";
const _trampoline24 = function(arg0) {
	_debugLog("[iface=\"wasi:clocks/wall-clock@0.2.12\", function=\"now\"] [Instruction::CallInterface] (sync, @ enter)");
	let parentTask;
	let task;
	let threadID;
	let subtask;
	let createTask = () => {
		({task, threadID} = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
			componentIdx: -1,
			isAsync: !1,
			entryFnName: "now$1",
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
			fn: () => _trackHostOperation(_jcoComponentHostOperationContext, () => now$1())
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
	var { seconds: v0_0, nanoseconds: v0_1 } = ret;
	dataView(_jcoDataViewCacheContext, memory0).setBigInt64((arg0 >>> 0) + 0, toUint64(_jcoStrictNumericContext, v0_0), !0);
	dataView(_jcoDataViewCacheContext, memory0).setInt32((arg0 >>> 0) + 8, toUint32(_jcoStrictNumericContext, v0_1), !0);
	_debugLog("[iface=\"wasi:clocks/wall-clock@0.2.12\", function=\"now\"][Instruction::Return]", {
		funcName: "now",
		paramCount: 0,
		async: !1,
		postReturn: !1
	});
	task.resolve([ret]);
	task.exit();
};
_trampoline24.fnName = "wasi:clocks/wall-clock@0.2.12#now$1";
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
	task.setReturnResultTypeIdx(22);
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
	paramLiftFns: [_liftFlatU8],
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
	importFn: _trampoline8
});
let trampoline9 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 9,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline9.manuallyAsync,
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
	importFn: _trampoline12
});
let trampoline13 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 13,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline13.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatU64.bind(void 0, _jcoStrictNumericContext)],
	hasResultPointer: !1,
	funcTypeIsAsync: !1,
	getCallbackFn: () => null,
	getPostReturnFn: () => null,
	isCancellable: !1,
	memoryIdx: null,
	stringEncoding: "utf8",
	getMemoryFn: () => null,
	getReallocFn: void 0,
	importFn: _trampoline13
});
let trampoline14 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 14,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline14.manuallyAsync,
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
	importFn: _trampoline14
});
let trampoline15 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 15,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline15.manuallyAsync,
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
	importFn: _trampoline15
});
let trampoline16 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 16,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline16.manuallyAsync,
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
	importFn: _trampoline17
});
let trampoline18 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 18,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline18.manuallyAsync,
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
	importFn: _trampoline18
});
let trampoline19 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 19,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline19.manuallyAsync,
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
	importFn: _trampoline19
});
let trampoline20 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 20,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline20.manuallyAsync,
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
	importFn: _trampoline21
});
let trampoline22 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 22,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline22.manuallyAsync,
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
	importFn: _trampoline22
});
let trampoline23 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 23,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline23.manuallyAsync,
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
	importFn: _trampoline23
});
let trampoline24 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 24,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline24.manuallyAsync,
	paramLiftFns: [],
	resultLowerFns: [_lowerFlatRecord({
		fieldMetas: [[
			"seconds",
			_lowerFlatU64.bind(void 0, _jcoStrictNumericContext),
			8,
			8
		], [
			"nanoseconds",
			_lowerFlatU32.bind(void 0, _jcoStrictNumericContext),
			4,
			4
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
	importFn: _trampoline24
});
await (() => {
	let gen = (function* _initGenerator() {
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABsAEaYAJ/fwBgBH9/f38AYAN/f38Bf2ABfwF/YAJ/fwF/YAF/AGAGf39/f39/AX9gA39/fwBgAAF/YAABfmABfgF/YAAAYAV/f39/fwBgA35+fwF+YAd/f39/f39/AGAGf39/f39/AGAEf39/fwF/YAR/f398AX9gBX9/f39/AX9gBH5+f38BfmACfH8Bf2ACf34Bf2AIf39/f39/f38AYAN/fn4AYAF/AX5gBX9+fn5+AAKlCRkgd2FzaTpyYW5kb20vaW5zZWN1cmUtc2VlZEAwLjIuMTINaW5zZWN1cmUtc2VlZAAFFHdhc2k6aW8vZXJyb3JAMC4yLjEyFFtyZXNvdXJjZS1kcm9wXWVycm9yAAUTd2FzaTppby9wb2xsQDAuMi4xMhdbcmVzb3VyY2UtZHJvcF1wb2xsYWJsZQAFFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAUWd2FzaTppby9zdHJlYW1zQDAuMi4xMhxbcmVzb3VyY2UtZHJvcF1vdXRwdXQtc3RyZWFtAAUed2FzaTpjbGkvdGVybWluYWwtaW5wdXRAMC4yLjEyHVtyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLWlucHV0AAUfd2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4xMh5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQABRt3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMTIPZ2V0LWVudmlyb25tZW50AAUUd2FzaTpjbGkvZXhpdEAwLjIuMTIEZXhpdAAFFHdhc2k6Y2xpL2V4aXRAMC4yLjEyDmV4aXQtd2l0aC1jb2RlAAUTd2FzaTppby9wb2xsQDAuMi4xMhZbbWV0aG9kXXBvbGxhYmxlLmJsb2NrAAUTd2FzaTppby9wb2xsQDAuMi4xMgRwb2xsAAcWd2FzaTppby9zdHJlYW1zQDAuMi4xMiFbbWV0aG9kXW91dHB1dC1zdHJlYW0uY2hlY2std3JpdGUAABZ3YXNpOmlvL3N0cmVhbXNAMC4yLjEyG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQABFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIkW21ldGhvZF1vdXRwdXQt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AgACQCABQQEQooGAgABFDQAgASABLQCUASIHQQFHOgCUASACIAMoAgg2AjggAiADKQIANwMwIAEoAjwhAwJAIAEoAlQiBSABKAJMRw0AIAFBzABqEKqAgIAACyABIAVBAWo2AlQgASgCUCAFQQN0aiIFIAM2AgQgBSADNgIAIAJBCGogARCzgICAACACKAIIIQMgAigCDCIBIAIoAjg2AowBIAEgAikDMDcChAEgASAHOgCUASABQTRqIgcQrICAgAAgAS0ADEECRw0AIANBAXFFDQAgASgCiAEhBSABKAKEASEIAkAgASgCjAEiA0UNAAJAIAMgBUkNACADIAVGDQEMBgsgCCADaiwAAEFASA0FCyADIAVGDQBBASEFAkAgCCADaiIILAAAIgZBf0oNACAILQABQT9xIQkgBkEfcSEKAkACQCAGQWBPDQAgCkEGdCAJciEGDAELIAlBBnQgCC0AAkE/cXIhCQJAIAZBcE8NACAJIApBDHRyIQYMAQsgCUEGdCAILQADQT9xciAKQRJ0QYCA8ABxciEGCyAGQYABSQ0AQQIhBSAGQYAQSQ0AQQNBBCAGQYCABEkbIQULIAEgBSADajYCjAEgBxCtgICAAEEAIQMMAgsgASACKAIoNgKMASABIAIpAyA3AoQBAkAgBiABKAIYSw0AIAEgBjYCGAsgAUE0ahCsgICAAAtBASEDCwJAIANBAUcNACABIAIoAhg2AowBIAEgAikDEDcChAECQCAEIAEoAhhLDQAgASAENgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIAAgATYCBCAAIAM2AgAgAkHAAGokgICAgAAPCyAIIAUgAyAFI4GAgIAAQaDYwoAAahCRg4CAAAALyw4BC38jgICAgABBEGsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQo4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCEEAIQkCQCADIAZHDQAgASgCMCABKAIkaiEJCwJAIAEoAowBIgNBfUsN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EDoAACALQX9qIgtBAUcNAAsgDCENCyANIBU6AAALIBRBAWoiFCATRw0ACwsgDEF/aiEQIAIgAUF/aiILaiEVIA8gC2ohFANAIA8gDC0AACITIAItAAAiACATIABJIhIbOgAAIBQgFS0AACILIBAtAAAiDSALIA1LGzoAACAUQX9qIRQgD0EBaiEPIBAgCyANSWshECAVIAsgDU9rIRUgAiATIABPaiECIAwgEmohDCAKQX9qIgoNAAsgEEEBaiELAkAgAUEBcUUNACAPIAIgDCACIAtJIg0bLQAAOgAAIAwgAiALT2ohDCACIA1qIQILAkAgAiALRw0AIAwgFUEBakYNAQsQo4OAgAAACyAHQRBqJICAgIAADwsAC7YBAgJ/AX5BASEGQQQhBwJAAkAgBa0gA61+IghCIIinRQ0AQQAhAwwBCwJAIAinIgNBgICAgHggBGtNDQBBACEDDAELAkACQAJAAkAgAUUNACACIAUgAWwgBCADEJeBgIAAIQcMAQsCQCADDQAgBCEHDAILEJiBgIAAIAMgBBCVgYCAACEHCyAHDQAgACAENgIEDAELIAAgBzYCBEEAIQYLQQghBwsgACAHaiADNgIAIAAgBjYCAAuHWwEKfyOAgICAAEHAAGsiAiSAgICAAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAoAgAiA0GAgICAeHNBBSADQQBIGw4GAAECAwQFAAsgAiABNgIsIAJBBTYCKCACQQQ2AiAgAkEFNgIYIAJBCjYCECACI4GAgIAAIgNBkKPAgABqNgIkIAIgA0HroMCAAGo2AhwgAiADQYujwIAAajYCFCACIANBgaPAgABqNgIMIAJBOGogAkEMahDLgICAACACKAI4IQECQCACLQA8IgRB/wFHDQAgASEDDAwLIAIgBDoAPCAAKAIMIQUgACgCCCEGIAIgATYCOCABKAIAIQMCQCAEQQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEHroMCAAGpBBBDMgICAACIDDQsCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQzICAgAAiAw0LIAAoAhghBSAAKAIUIQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB76DAgABqQQcQzICAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMyAgIAAIgMNCyAALQA0IQUCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB9qDAgABqQQkQzICAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAI4GAgIAAIQMgASgCACADQdjewoAAaiAFQQJ0aigCAEECEMyAgIAAIgMNCyAAKAIkIQYgACgCICEHAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0H/oMCAAGpBBRDMgICAACIDDQsCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCegICAACABKAIIIQMLIAEgA0EBaiIFNgIIIAEoAgQgA2pB2wA6AAAgBkUNBSAGQRxsIQggB0EYaiEEQQEhAwNAAkACQCADQQFxRQ0AIAUhAwwBCwJAIAEoAgAgBUcNACABIAVBAUEBQQEQnoCAgAAgASgCCCEFCyABIAVBAWoiAzYCCCABKAIEIAVqQSw6AAALAkAgASgCACADRw0AIAEgA0EBQQFBARCegICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQfsAOgAAIARBcGooAgAhBSAEQWxqKAIAIQYgASOBgICAAEHCoMCAAGpBAhDMgICAACIDDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQnoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAIAEgBiAFEMyAgIAAIgMNDCAEQXxqKAIAIQUgBEF4aigCACEGAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJ6AgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBLDoAACABI4GAgIAAQcSgwIAAakEFEMyAgIAAIgMNDAJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCegICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQTo6AAAgASAGIAUQzICAgAAiAw0MIAQtAAAhBQJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCegICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQSw6AAAgASOBgICAAEHJoMCAAGpBBRDMgICAACIDDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQnoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAAkACQAJAAkACQCAFDgQAAQIDAAsgASOBgICAAEGqoMCAAGpBBBDMgICAACEDDAMLIAEjgYCAgABBrqDAgABqQQcQzICAgAAhAwwCCyABI4GAgIAAQbWgwIAAakEHEMyAgIAAIQMMAQsgASOBgICAAEG8oMCAAGpBBhDMgICAACEDCyADDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQnoCAgAAgASgCCCEDCyABIANBAWoiBTYCCCABKAIEIANqQf0AOgAAIARBHGohBEEAIQMgCEFkaiIIDQALIAEoAgAgBUcNCgwJCyACIAE2AiwgAkEDNgIoIAJBBDYCICACQQM2AhggAkEKNgIQIAIjgYCAgAAiA0GYo8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBlaPAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMuAgIAAIAIoAjghAyACLQA8IgFB/wFGDQogAiABOgA0IAIgAzYCMCACQTBqI4GAgIAAQYmhwIAAakEFIABBEGoQzYCAgAAiAw0KIAIoAjAiASgCACEDIAAoAgwhBSAAKAIIIQACQCACLQA0QQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEGKosCAAGpBBhDMgICAACIDDQoCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgMoAgAgAygCCCIGRw0AIAMgBkEBQQFBARCegICAACADKAIIIQYLIAMgBkEBaiIENgIIIAMoAgQgBmpB2wA6AAACQAJAIAUNAAJAIAMoAgAgBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAwBCwJAIAMoAgAgBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQQgACgCECEGIAAoAgwhCCADIARBxKDAgABqQQUQzICAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgCCAGEMyAgIAAIgMNCyACQThqI4GAgIAAQZCiwIAAakEFIAArAwAQzoCAgAAiAw0LAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALAkAgBUEBRg0AIABBGGohACAFQRhsQWhqIQgDQAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAAAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB+wA6AAAgAiABNgI4IAJBAjoAPCAAQRBqKAIAIQUgAEEMaigCACEGIAMjgYCAgABBxKDAgABqQQUQzICAgAAiAw0NAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMyAgIAAIgMNDSACQThqI4GAgIAAQZCiwIAAakEFIAArAwAQzoCAgAAiAw0NAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALIABBGGohACAIQWhqIggNAAsLAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakHdADoAAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhAwwKCyACIAE2AiwgAkEFNgIoIAJBBDYCICACQQU2AhggAkEKNgIQIAIjgYCAgAAiA0Ggo8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBm6PAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMuAgIAAIAIoAjghAyACLQA8IgFB/wFGDQkgAiABOgA0IAIgAzYCMCACQTBqI4GAgIAAQYmhwIAAakEFIABBEGoQzYCAgAAiAw0JIAIoAjAiASgCACEDIAAoAgwhBSAAKAIIIQQCQCACLQA0QQFGDQACQCADKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAIAEoAgAhAwsgAkECOgA0IAMjgYCAgABBlaLAgABqQQgQzICAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWoiBjYCCCADKAIEIABqQdsAOgAAAkACQCAFDQACQCADKAIAIAZHDQAgAyAGQQFBAUEBEJ6AgIAAIAMoAgghBgsgAyAGQQFqNgIIIAMoAgQgBmpB3QA6AAAMAQsgBCAFQRhsaiEJQQEhAANAIAEoAgAhAwJAIABBAXENAAJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAAgASgCACEDCwJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQfsAOgAAI4GAgIAAIQMgBCgCCCEFIAQoAgQhBiABKAIAIANBnaLAgABqQQQQzICAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAIAEoAgAgBiAFEMyAgIAAIgMNCyAEKAIUIQYgBCgCECEFAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAI4GAgIAAIQMgASgCACADQaGiwIAAakEFEMyAgIAAIgMNCwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBOjoAAAJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqIgg2AgggAygCBCAAakHbADoAAAJAAkAgBg0AAkAgAygCACAIRw0AIAMgCEEBQQFBARCegICAACADKAIIIQgLIAMgCEEBajYCCCADKAIEIAhqQd0AOgAADAELAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQAgBSgCCCEIIAUoAgQhByADIABBnaLAgABqQQQQzICAgAAiAw0MAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAIAEoAgAgByAIEMyAgIAAIgMNDCACQThqI4GAgIAAQcKgwIAAakECIAVBGGoQzYCAgAAiAw0MIAJBOGojgYCAgABBpqLAgABqQQQgBSgCECAFKAIUEM+AgIAAIgMNDCACQThqI4GAgIAAQaqiwIAAakEIIAVBJGoQzYCAgAAiAw0MAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AAALAkAgBkEBRg0AIAZBMGxBUGohCkEAIQgDQAJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBLDoAAAJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB+wA6AAAgAiABNgI4IAJBAjoAPCAFIAhqIgBBOGooAgAhByAAQTRqKAIAIQsgAyOBgICAAEGdosCAAGpBBBDMgICAACIDDQ4CQCABKAIAIgMoAgAgAygCCCIGRw0AIAMgBkEBQQFBARCegICAACADKAIIIQYLIAMgBkEBajYCCCADKAIEIAZqQTo6AAAgASgCACALIAcQzICAgAAiAw0OIAJBOGojgYCAgABBwqDAgABqQQIgAEHIAGoQzYCAgAAiAw0OIAJBOGojgYCAgABBpqLAgABqQQQgAEHAAGooAgAgAEHEAGooAgAQz4CAgAAiAw0OIAJBOGojgYCAgABBqqLAgABqQQggAEHUAGoQzYCAgAAiAw0OAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AAALIAogCEEwaiIIRw0ACwsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQd0AOgAACwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AABBACEAIARBGGoiBCAJRw0ACwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB3QA6AAALAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH9ADoAAEEAIQMMCQsgAiABNgIsIAJBCDYCKCACQQQ2AiAgAkEINgIYIAJBCjYCECACI4GAgIAAIgNBraPAgABqNgIkIAIgA0HroMCAAGo2AhwgAiADQaWjwIAAajYCFCACIANBgaPAgABqNgIMIAJBOGogAkEMahDLgICAACACKAI4IQMgAi0APCIBQf8BRg0IIAIgAToAPCACIAM2AjggAkE4aiOBgICAAEHDocCAAGpBDCAAKAIIIAAoAgwQz4CAgAAiAw0IIAIoAjgiBSgCACEDIAAoAhghBCAAKAIUIQYCQCACLQA8QQFGDQACQCADKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAIAUoAgAhAwsgAyOBgICAAEHPocCAAGpBCBDMgICAACIDDQgCQCAFKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQTo6AAACQCAFKAIAIgAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCegICAACAAKAIIIQMLIAAgA0EBaiIBNgIIIAAoAgQgA2pB2wA6AAAgBEUNAyAEQShsIQtBACEEQQEhAwNAAkACQCADQQFxRQ0AIAEhAwwBCwJAIAAoAgAgAUcNACAAIAFBAUEBQQEQnoCAgAAgACgCCCEBCyAAIAFBAWoiAzYCCCAAKAIEIAFqQSw6AAALAkAgACgCACADRw0AIAAgA0EBQQFBARCegICAACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQfsAOgAAIAYgBGoiAUEIaigCACEIIAFBBGooAgAhByAAI4GAgIAAQdehwIAAakEEEMyAgIAAIgMNCQJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCegICAACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQTo6AAAgACAHIAgQzICAgAAiAw0JIAFBFGooAgAhCCABQRBqKAIAIQcCQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQnoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakEsOgAAIAAjgYCAgABB26HAgABqQQIQzICAgAAiAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJ6AgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBOjoAACAAIAcgCBDMgICAACIDDQkgAUEgaigCACEIIAFBHGooAgAhBwJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCegICAACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQSw6AAAgACOBgICAAEHdocCAAGpBBBDMgICAACIDDQkCQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQnoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakE6OgAAIAAgByAIEMyAgIAAIgMNCSABQSRqLQAAIQECQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQnoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakEsOgAAIAAjgYCAgABB4aHAgABqQQkQzICAgAAiAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJ6AgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBOjoAAAJAAkACQAJAAkAgAQ4EAAECAwALIAAjgYCAgABB6qHAgABqQQUQzICAgAAhAwwDCyAAI4GAgIAAQe+hwIAAakEGEMyAgIAAIQMMAgsgACOBgICAAEH1ocCAAGpBChDMgICAACEDDAELIAAjgYCAgABB/6HAgABqQQsQzICAgAAhAwsgAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJ6AgIAAIAAoAgghAwsgACADQQFqIgE2AgggACgCBCADakH9ADoAAEEAIQMgCyAEQShqIgRHDQALIAAoAgAgAUcNBQwECyACIAE2AiwgAkEFNgIoIAJBBDYCICACQQU2AhggAkEKNgIQIAIjgYCAgAAiA0G6o8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBtaPAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMuAgIAAIAIoAjghAQJAIAItADwiBEH/AUcNACABIQMMCAsgASgCACEDIAAoAgwhBiAAKAIIIQUCQCAEQQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEHrosCAAGpBBxDMgICAACIDDQcCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgMoAgAgAygCCCIIRw0AIAMgCEEBQQFBARCegICAACADKAIIIQgLIAMgCEEBaiIENgIIIAMoAgQgCGpB2wA6AAACQAJAIAYNAAJAIAMoAgAgBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAwBCwJAIAMoAgAgBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQQgBSgCCCEIIAUoAgQhByADIARBnaLAgABqQQQQzICAgAAiAw0IAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMyAgIAAIgMNCCACQThqI4GAgIAAQcyiwIAAakEKIAUoAhAgBSgCFBDQgICAACIDDQggAkE4aiOBgICAAEHWosCAAGpBByAFKAIcIAUoAiAQ0ICAgAAiAw0IAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALAkAgBkEBRg0AIAZBJGxBXGohCkEAIQYDQAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAAAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB+wA6AAAgAiABNgI4IAJBAjoAPCAFIAZqIgRBLGooAgAhByAEQShqKAIAIQsgAyOBgICAAEGdosCAAGpBBBDMgICAACIDDQoCQCABKAIAIgMoAgAgAygCCCIIRw0AIAMgCEEBQQFBARCegICAACADKAIIIQgLIAMgCEEBajYCCCADKAIEIAhqQTo6AAAgASgCACALIAcQzICAgAAiAw0KIAJBOGojgYCAgABBzKLAgABqQQogBEE0aigCACAEQThqKAIAENCAgIAAIgMNCiACQThqI4GAgIAAQdaiwIAAakEHIARBwABqKAIAIARBxABqKAIAENCAgIAAIgMNCgJAIAItADxFDQACQCACKAI4KAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQf0AOgAACyAKIAZBJGoiBkcNAAsLAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAsgACgCGCEEIAAoAhQhBgJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBLDoAACOBgICAACEDIAEoAgAgA0HyosCAAGpBDRDMgICAACIDDQcCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQTo6AAACQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBaiIFNgIIIAMoAgQgAGpB2wA6AAACQAJAIAQNAAJAIAMoAgAgBUcNACADIAVBAUEBQQEQnoCAgAAgAygCCCEFCyADIAVBAWo2AgggAygCBCAFakHdADoAAAwBCyAEQTxsIQtBACEFQQEhAANAIAEoAgAhAwJAIABBAXENAAJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAAgASgCACEDCwJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQfsAOgAAIAIgATYCOCAGIAVqIgBBCGooAgAhCCAAQQRqKAIAIQcgAyOBgICAAEHXocCAAGpBBBDMgICAACIDDQkCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAHIAgQzICAgAAiAw0JIABBFGooAgAhCCAAQRBqKAIAIQcCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB26HAgABqQQIQzICAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMyAgIAAIgMNCSAAQSBqKAIAIQggAEEcaigCACEHAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0HdosCAAGpBBxDMgICAACIDDQkCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAHIAgQzICAgAAiAw0JIAJBOGojgYCAgABBxKDAgABqQQUgAEEwahDNgICAACIDDQkgAEEsaigCACEIIABBKGooAgAhByACKAI4IgAoAgAhAwJAIAItADxBAUYNAAJAIAMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAgACgCACEDCyADI4GAgIAAQeSiwIAAakEHEMyAgIAAIgMNCQJAIAAoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJ6AgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACAAKAIAIAcgCBDMgICAACIDDQkCQCAAKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhACALIAVBPGoiBUcNAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCegICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQd0AOgAACwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJ6AgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AABBACEDDAcLIAIgATYCLCACQQg2AiggAkEENgIgIAJBCDYCGCACQQo2AhAgAiOBgICAACIDQcejwIAAajYCJCACIANB66DAgABqNgIcIAIgA0G/o8CAAGo2AhQgAiADQYGjwIAAajYCDCACQThqIAJBDGoQy4CAgAAgAigCOCEDIAItADwiAUH/AUYNBiACIAE6ADwgAiADNgI4IAJBOGojgYCAgABBiaHAgABqQQUgAEHIAGoQzYCAgAAiAw0GIAIoAjgiASgCACEDIAAoAgghBSAAKAIEIQYCQCACLQA8QQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEGOocCAAGpBCRDMgICAACIDDQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQzICAgAAiAw0GIAAoAhQhBSAAKAIQIQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANBl6HAgABqQQoQzICAgAAiAw0GAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMyAgIAAIgMNBiAAKAIgIQUgACgCHCEGAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQnoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0GhocCAAGpBCxDMgICAACIDDQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQzICAgAAiAw0GIAJBOGojgYCAgABBrKHAgABqQQggACgCKCAAKAIsENGAgIAAIgMNBiACQThqIAAoAjQgACgCOBDSgICAACIDDQYgAkE4aiAAKAJAIAAoAkQQ04CAgAAiAw0GIAIoAjgoAgAgAi0APBDUgICAACEDDAYLIAEoAgAgBUYNAwwECyAAKAIAIAFHDQELIAAgAUEBQQFBARCegICAACAAKAIIIQELIAAoAgQgAWpB3QA6AAAgACABQQFqNgIIAkAgBSgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQnoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH9ADoAAEEAIQMMAgsgASAFQQFBAUEBEJ6AgIAAIAEoAgghBQsgASgCBCAFakHdADoAACABIAVBAWo2AgggAkE4aiAAKAIsIAAoAjAQ1YCAgAAiAw0AIAIoAjgoAgAgAi0APBDUgICAACEDCyACQcAAaiSAgICAACADC/IBAQR/AkAgASgCICICKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCegICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQfsAOgAAIAEoAhwhBCABKAIYIQVB/wEhAwJAIAIoAgAgASgCECABKAIUEMyAgIAAIgENAAJAIAIoAgAiASgCACABKAIIIgNHDQAgASADQQFBAUEBEJ6AgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAAEF/QQIgAigCACAFIAQQzICAgAAiARshAyABIAIgARshAQsgACADOgAEIAAgATYCAAvpBAEGfwJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCegICAACAAKAIIIQMLIAAgA0EBaiIENgIIIAAoAgQgA2pBIjoAAAJAIAJFDQADQCACIQVBACEDAkADQCABIANqIgYtAAAiByOEgICAAGotAAAiAg0BIAUgA0EBaiIDRw0ACyAFIQIMAgsCQCADRQ0AAkAgAyAAKAIAIARrTQ0AIAAgBCADQQFBARCegICAACAAKAIIIQQLAkAgA0UNACAAKAIEIARqIAEgA/wKAAALIAAgBCADaiIENgIICwJAAkAgAkH1AEcN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Sw0AIAEgBzYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACwJAIANBAUcNACABIAIoAig2AowBIAEgAikDIDcChAECQCAEIAEoAhhLDQAgASAENgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIAAgAzYCACAAIAE2AgQgAkHgAGokgICAgAALlBUBDn8jgICAgABB8ABrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEKOAgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKQQEhAwJAAkACQAJAAkACQAJAIAFBARCigYCAAEUNACABKAIYIQsgAiABKAKMATYCSCACIAEpAoQBNwNAIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAFBhAFqIgwoAgg2AlggAiAMKQIANwNQIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkACQCABQQEQooGAgABFDQAgAkE4aiABELaAgIAAIAIoAjwhAQJAIAIoAjhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhDAwBCyABKAIYIQ8gAiABKAKMATYCaCACIAEpAoQBNwNgIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAIAJBMGogARC2gICAACACKAI0IQECQCACKAIwIgxBAUcNACABIAIoAmg2AowBIAEgAikDYDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAEL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VCIGIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgBkEBajYCVCABKAJQIAZBA3RqIgYgBTYCBCAGIAU2AgAgAkEoaiABELaAgIAAIAIoAiwhAQJAIAIoAigiBUEBRw0AIAEgAigCeDYCjAEgASACKQNwNwKEAQJAIAkgASgCGEsNACABIAk2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsgBUEBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCaDYCjAEgASACKQNgNwKEAQJAIAggASgCGEsNACABIAg2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAACACQSBqIAEQ24CAgAAgAigCJCEBIAIoAiBBAXENACABQQEQooGAgABFDQAgASgCGCEIIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCqgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBGGogARC2gICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCqgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQRBqIAEQtoCAgAAgAigCFCEBAkAgAigCECIFQQFHDQAgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACwJAIAVBAXENAANAAkACQCABQQEQooGAgAANAEEBIQUMAQsgASgCGCEJIAIgASgCjAE2AnggAiABKQKEATcDcCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCqgICAAAsgASAGQQFqNgJUIAEoAlAgBkEDdGoiBiAFNgIEIAYgBTYCACACQQhqIAEQtoCAgAAgAigCDCEBAkAgAigCCCIFQQFHDQAgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgCSABKAIYSw0AIAEgCTYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACyAFQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJoNgKMASABIAIpA2A3AoQBAkAgCCABKAIYSw0AIAEgCDYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAAIAIgARDcgICAACACKAIEIQEgAigCACEDCwJAIANBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAHIAEoAhhLDQAgASAHNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALAkAgA0EBRw0AIAEgAigCSDYCjAEgASACKQNANwKEAQJAIAQgASgCGEsNACABIAQ2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsgACADNgIAIAAgATYCBCACQYABaiSAgICAAAuKCQELfyOAgICAAEEgayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCjgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCiACQRhqIAEQjYGAgAAgAigCHCEBAkACQAJAIAIoAhhBAUcNACACQRBqIAEQqICAgAAgAigCFCEBIAIoAhBBAUcNACACQQhqIAEQtYCAgAAgAigCDCEBIAIoAghBAXENAQtBACELDAELIAIgARCigICAACACKAIEIQEgAigCACELC0EBIQMgAS0AlAEhDAJAAkACQAJAAkACQCALQQFHDQAgDEH/AXFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAxB/wFxQQFHDQMgAS0AlQFFDQQCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgxqIgYgCE0NACAGIAhrQQFGDQcLAkAgBSAMSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0FIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQpYCAgAALIAEoAiwgA2pBEzoAACABIANBAWo2AjAgAS0AlAEhDAwDCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahClgICAAAsgASADQQFqNgIkIAEoAiAgA2pBEzoAAAtBASEDAkAgAS0AgAFBAUcNACABLQCVAUUNACABQdgAakETQQAgCiABKAJ8IAlLGxCmgICAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIAxB/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiBi0AAA0BIAYgAzYCBCABKAKMASEMAkAgASgCGCIGIAEoAhBHDQAgAUEQahCjgICAAAsgASgCFCAGQRRsaiIDIAw2AhAgA0EANgIIIAMgBzYCBCADQYEmOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABBrNbCgABqEISDgIAAAAsjgYCAgAAiAUGRn8CAAGpBKCABQbzWwoAAahD2goCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBE0EAIAogASgCfCAJSxsQpoCAgAALIAAgATYCBCAAIAM2AgAgAkEgaiSAgICAAAuYEAEOfyOAgICAAEHgAGsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQo4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQpBASELAkAgAUEBEKKBgIAARQ0AIAEoAhghDCACIAEoAowBNgI4IAIgASkChAE3AzAgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALQQEhCyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBKGogARCLgYCAACACKAIsIQECQCACKAIoQQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAEoAowBNgJIIAIgASkChAE3A0AgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQSBqIAEQtoCAgAAgAigCJCEBAkAgAigCIEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgJYIAIgASkChAE3A1AgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEYaiABELaAgIAAIAIoAhwhAQJAIAIoAhgiA0EBRw0AIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgJYIAIgASkChAE3A1AgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEQaiABELaAgIAAIAIoAhQhAQJAIAIoAhAiA0EBRw0AIAEgAigCWDYCjAEgASACKQNQNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCSDYCjAEgASACKQNANwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAEEBIQsgAUEBEKKBgIAARQ0AIAJBCGogARCOgYCAACACKAIMIQECQCACKAIIIgtBAUcNACABLQAMQQJHDQELQQAhCwsCQCALQQFHDQAgASAC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AAAMAgsCQCABDgIAAAILIAdFDQEgBiAHQQEQloGAgAAPCwJAIAEOAgAAAQsgB0UNACAGIAdBARCWgYCAAA8LC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEQEMmAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDpgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEBQQIQyYCAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEOmCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAtRAQF/AkAgACgCACIAKAIIIgFFDQAgACgCDCABQRRsQQQQloGAgAALAkAgAEF/Rg0AIAAgACgCBEF/aiIBNgIEIAENACAAQRRBBBCWgYCAAAsLVAEBfwJAIAAoAgAiACgCCCIBRQ0AIABBDGooAgAgAUECdEEEEJaBgIAACwJAIABBf0YNACAAIAAoAgRBf2oiATYCBCABDQAgAEEUQQQQloGAgAALC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEoEMmAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDpgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEEQRgQyYCAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEOmCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAt/AQN/I4CAgIAAQRBrIgEkgICAgAAgAUEEaiAAKAIAIgIgACgCBCACQQF0IgJBBCACQQRLGyICQQhBIBDJgICAAAJAIAEoAgRBAUcNACABKAIIIAEoAgwQ6YKAgAAACyABKAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAo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ApABIQICQAJAAkACQAJAAkACQAJAAkACQCADKAKUASIBDg0IAQEBAQEBAQEBAQEAAQsgAikAAELj2IWbt47RtOEAhSACQQhqNQAAQufkhesGhYRQDQcgCiADKAK4ASIMQX9HcQ0GIAIoAABB49iFmwdzIAJBBGovAABB88AAc3JFDQEMCAsgCiADKAK4ASIMQX9HcQ0BIAFBBkkNByACKAAAQePYhZsHcyACQQRqLwAAQfPAAHNyDQcgAUEISQ0CCyADQYgBakH7ACACIAEQnIOAgAAgAygCiAFBAXFFDQYMAgsgAUEBRw0DIAItAABB/QBHDQMgC0F/aiILDQMgA0GQA2ogA0G4AWoQ74KAgAAgBSADKALIASADKALMARD/gICAACAEIAMoAtQBIAMoAtgBEP+AgIAAAkAgAygCqAEiASADKAKgAUcNACADQaABahDxgICAAAsgAygCpAEgAUEkbGoiAiADKAKwAzYCICACIAMpAqgDNwIYIAIgAykCoAM3AhAgAiADKQKYAzcCCCACIAMpApADNwIAIAMgAUEBajYCqAEgAygCuAEiAkF/Rg0CAkAgAkUNACADKAK8ASACQQEQloGAgAALIAgQv4CAgAAgBxC/gICAAAwCCyACLQAAQfsARg0AIAItAAFB+wBGDQAgAi0AAkH7AEYNACACLQADQfsARg0AIAItAARB+wBGDQAgAi0ABUH7AEYNACABQQZGDQQgAi0ABkH7AEcNBAsCQAJAIAIoAABB49iFmwdzIAJBBGovAABB88AAc3JFDQAgAEF/NgIADAELIANBgAFqIAJBBmogAUF6ahCbgICAACADKAKAASEOIAMoAoQBIQ0gA0EBOwG0AyADIA02ArADIANBADYCrAMgA0EBOgCoAyADQfsANgKkAyADIA02AqADIANBADYCnAMgAyANNgKYAyADIA42ApQDIANB+wA2ApADIANB+ABqIANBkANqEPaAgIAAAkACQAJAAkACQCADKAJ4Ig1FDQAgA0HwAGogDSADKAJ8EJuAgIAAQQAhDgJAIAMoAnQiDUEASA0AIA1FDQMgAygCcCEPEJiBgIAAQQEhDiANQQEQlYGAgAAiEA0CIA0hEAsgDiAQEOmCgIAAAAsgAEF/NgIADAQLAkAgDUUNACAQIA8gDfwKAAALIANCBDcC8AIgA0IANwLoAiAD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A0GEA2ogA0GQA2oQgIGAgAACQCADKAKEA0UNACAMQYDbwoAAakEYaiERDAELQQMhDSADQZADaiACIAEjgYCAgAAiDEHJpsCAAGpBAxCPg4CAACADQYQDaiADQZADahCAgYCAAAJAIAMoAoQDRQ0AIAxBgNvCgABqQTBqIREMAQtBBCENIANBkANqIAIgASOBgICAACIMQdemwIAAakEEEI+DgIAAIANBhANqIANBkANqEICBgIAAAkAgAygChANFDQAgDEGA28KAAGpByABqIREMAQtBAyENIANBkANqIAIgASOBgICAACIMQeWmwIAAakEDEI+DgIAAIANBhANqIANBkANqEICBgIAAAkAgAygChANFDQAgDEGA28KAAGpB4ABqIREMAQtBAiENIANBkANqIAIgASOBgICAACIMQfKmwIAAakECEI+DgIAAIANBhANqIANBkANqEICBgIAAAkAgAygChANFDQAgDEGA28KAAGpB+ABqIREMAQtBAyENIANBkANqIAIgASOBgICAACIMQfimwIAAakEDEI+DgIAAIANBhANqIANBkANqEICBgIAAAkAgAygChANFDQAgDEGA28KAAGpBkAFqIREMAQtBAyENIANBkANqIAIgASOBgICAACIMQdSjwIAAakEDEI+DgIAAIANBhANqIANBkANqEICBgIAAAkAgAygChANFDQAgDEGA28KAAGpBqAFqIREMAQtBAiENIANBkANqIAIgASOBgICAACIMQY+nwIAAakECEI+DgIAAIANBhANqIANBkANqEICBgIAAIAMoAoQDRQ0BIAxBgNvCgABqQcABaiERCwJAIAMoAogDIgxFDQACQAJAIAwgAUkNACAMIAFGDQIMAQsgAiAMaiwAAEG/f0oNAQsgAiABQQAgDCOBgICAAEHY3MKAAGoQkYOAgAAACyADQTBqIAIgDBCbgICAACADKAI0IRIgAygCMCETAkAgDCANaiIMRQ0AAkACQCABIAxLDQAgASAMRg0CDAELIAIgDGosAABBv39KDQELIAIgASAMIAEjgYCAgABB6NzCgABqEJGDgIAAAAsgAiAMaiEPIAEgDGshDkEAIQ0CQAJAA0AgDyANaiEBAkACQCAOIA1rIgxBB0sNACAOIA1GDQNBACECA0AgASACai0AAEE6Rg0CIAwgAkEBaiICRw0ADAQLCyADQShqQTogASAMEJyDgIAAIAMoAihBAXFFDQIgAygCLCECCwJAIAIgDWoiAiAOTw0AIA8gAmotAABBOkcNACADQSBqIA8gAhCbgICAAEEAIQ0CQAJAIAMoAiQiAUEASA0AAkAgAQ0AQQEhDAwCCyADKAIgIRQQmIGAgABBASENIAFBARCVgYCAACIMRQ0AIAFFDQEgDCAUIAH8CgAADAELIA0gARDpgoCAAAALAkACQAJAAkAgDiACQQFqIgJNDQAgDyACaiwAAEG/f0wNAQsgA0EYaiAPIAJqIA4gAmsQm4CAgABBACENIAMoAhwiAkEASA0CIAINAUEAIQJCASEVDAYLIA8gDiACIA4jgYCAgABB+NzCgABqEJGDgIAAAAsgAygCGCEPEJiBgIAAQQEhDSACQQEQlYGAgAAiDkUNAAJAIAJFDQAgDiAPIAL8CgAACyACrUIghiAOrYQhFQwECyANIAIQ6YKAgAAACyAOIAJBAWoiDU8NAAsLIANBEGogDyAOEJuAgIAAQQAhAgJAAkAgAygCFCIBQQBIDQAgAUUNAyADKAIQIQ0QmIGAgABBASECIAFBARCVgYCAACIMDQELIAIgARDpgoCAAAALAkAgAUUNACAMIA0gAfwKAAALQX8hAgsgFachDgJAAkAgEkUNACABDQELAkAgAkEBSA0AIA4gAkEBEJaBgIAACyABRQ0BIAwgAUEBEJaBgIAADAELIANBhANqIBMgEhD9gICAACADQZADaiAMIAEQ/YCAgABBACEPAkACQCARKAIMIg1BAEgNAAJAIA0NAEEBIRIMAgsgESgCCCETEJiBgIAAQQEhDyANQQEQlYGAgAAiEkUNACANRQ0BIBIgEyAN/AoAAAwBCyAPIA0Q6YKAgAAAC0F/IQ8CQAJAIAJBf0YNAAJAIBVC/////w9YDQAgAiEPDAILIAJFDQAgDiACQQEQloGAgAALC0EAIQIgESgCFCIOQQBIDQECQAJAIA4NAEEBIRMMAQsgESgCECEREJiBgIAAQQEhAiAOQQEQlYGAgAAiE0UNAiAORQ0AIBMgESAO/AoAAAsgAyADKQKQAzcD+AIgAyADKAKYAzYCgAMgAykCiAMhFiADKAKEAyERIAwgAUEBEJaBgIAAIBFBf0YNAAJAIAMoArQBIgEgAygCrAFHDQAgA0GsAWoQ8oCAgAALIAMoArABIAFBPGxqIgIgFjcCBCACIBE2AgAgAiADKQP4AjcCDCACIAMoAoADNgIUIAIgFTcCNCACIA82AjAgAiAONgIsIAIgEzYCKCACIA42AiQgAiANNgIgIAIgEjYCHCACIA02AhggAyABQQFqNgK0AQsgA0EIaiADQdwBahD1gICAACADKAIMIQIgAygCCCIBDQEMAgsLIAIgDhDpgoCAAAALAkACQAJAAkACQCADKAK4AUF/Rg0AIAMgAykDyAE3A6ADIAMgAygC2AE2ArADIAMgAykD0AE3A6gDIAMgAykDwAE3A5gDIAMgAykDuAE3A5ADIAMoAqQDDQEgAygCsAMNAQJAIAMoApADIgJFDQAgAygClAMgAkEBEJaBgIAACyADQZwDahC/gICAACADQagDahC/gICAACADKAKoASECDAILIAMoAqgBDQIgAEF/NgIADAQLAkAgAygCqAEiASADKAKgAUcNACADQaABahDxgICAAAsgAygC2AEhDCADKQPQASEVIAMpA8gBIRYgAykDwAEhFyADKAKkASABQSRsaiICIAMpA7gBNwIAIAIgFzcCCCACIBY3AhAgAiAVNwIYIAIgDDYCICADIAFBAWoiAjYCqAELIAJFDQELIAAgAykCoAE3AgAgAyADKAKoATYCmAMgAyADKQKsATcCnAMgACADKQOYAzcCCCADIAMoArQBNgKkAyAAIAMpA6ADNwIQDAILIABBfzYCAAsgA0GsAWoQwYCAgAAgAygCpAEhDQJAIAMoAqgBIgFFDQAgDSECA0ACQCACKAIAIgxFDQAgAkEEaigCACAMQQEQloGAgAALIAJBDGoQv4CAgAAgAkEYahC/gICAACACQSRqIQIgAUF/aiIBDQALCyADKAKgASICRQ0AIA0gAkEkbEEEEJaBgIAACyADQdADaiSAgICAAAuaAgEIfyOAgICAAEEwayIDJICAgIAAAkACQAJAIAINAEEEIQQMAQsQmIGAgAAgAkEobCIFQQQQlYGAgAAiBEUNASACQShsIQYgA0EIakEYaiEHIANBCGpBDGohCEEAIQkgAiEKA0AgBiAJRg0BIANBCGogARDvgoCAACAIIAFBDGoQ74KAgAAgByABQRhqEO+CgIAAIAQgCWoiBSADKQIINwIAIAUgAykCEDcCCCAFIAMpAhg3AhAgBSADKQIg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IAIQnYOAgAAgAygCOEEBRw0JAkAgASADKAI8IgJqLQAAQTpGDQAgAiAISw0KDAELCyADQTBqIAEgAhCbgICAAEEAIQYCQAJAIAMoAjQiBEEASA0AAkAgBA0AQQEhCgwCCyADKAIwIQkQmIGAgABBASEGIARBARCVgYCAACIKRQ0AIARFDQEgCiAJIAT8CgAADAELIAYgBBDpgoCAAAALAkAgCCACQQFqIgJNDQAgASACaiwAAEG/f0wNAgsgA0EoaiABIAJqIAggAmsQm4CAgABBACEBIAMoAiwiAkEASA0EIAINAgtBASEIQQAhAgwCCyABIAggAiAII4GAgIAAQYjdwoAAahCRg4CAAAALIAMoAighBhCYgYCAAEEBIQEgAkEBEJWBgIAAIghFDQEgAkUNACAIIAYgAvwKAAALIARFDQEgA0GgAWogCCACEKiDgIAAIAMtAKABQQFGDQEgAysDqAEiDb0iDkL///////////8AgyIPUCAPQn98Qv////////8HVCAOQgBTIgFxciAPQoCAgICAgID4/wBRciAPQoCAgICAgID4/wBVciAPQoCAgICAgIB4fEKAgICAgICA8P8AVCABcXINAQJAIAJFDQAgCCACQQEQloGAgAALAkAgAygCdCIBIAMoAmxHDQAgA0HsAGoQ84CAgAALIAMoAnAgAUEYbGoiAiAENgIQIAIgCjYCDCACIAQ2AgggAiANOQMAIAMgAUEBajYCdAwECyABIAIQ6YKAgAAACwJAIAJFDQAgCCACQQEQloGAgAALIARFDQIgCiAEQQEQloGAgAAMAgsgA0HIAGogAUEDaiAIQX1qEJuAgIAAIAMoAkwiAkEGSQ0DIAMoAkgiASgAAEH00tHjBnMgAUEEai8AAEHlwABzcg0DIANBwABqIAFBBmogAkF6ahCbgICAAEEAIQICQAJAAkAgAygCRCILQQBIDQACQCALDQBBASEGQQEhEAwDCyADKAJAIQEQmIGAgABBASECIAtBARCVgYCAACIGDQEgCyEQCyACIBAQ6YKAgAAACwJAIAtFDQAgBiABIAv8CgAACyAGIRALIAshBCAHQQBMDQQLIAUgB0EBEJaBgIAAIAshBAwDCyADQQhqIANB+ABqEPWAgIAAIAMoAgwhAiADKAIIIgENAAsgBSEGIAchBAwDCyAFIQYgByEECyADIANB+ABqEPWAgIAAIAMoAgQhAiADKAIAIgENAAsLAkACQCADKAJ0RQ0AIAAgAygCdDYCCCAAIAMpAmw3AgAgACALNgIUIAAgBjYCECAAIAQ2AgwMAQsgAEF/NgIAAkAgAygCbCICRQ0AIAMoAnAgAkEYbEEIEJaBgIAACyAEQQFIDQAgBiAEQQEQloGAgAALIANBsAFqJICAgIAAC78gARp/I4CAgIAAQcACayIDJICAgIAAIANBADYClAEgA0KAgICAwAA3AowBIANBADsBvAEgAyACNgK4ASADQQA2ArQBIANBAToAsAEgA0EKNgKsASADIAI2AqgBIANBADYCpAEgAyACNgKgASADIAE2ApwBIANBCjYCmAEgA0GAAWogA0GYAWoQ9YCAgAACQAJAIAMoAoABIgENAEF/IQQMAQsgA0HoAWpBDGohBSADKAKEASECQX8hBANAAkACQCACDQBBACECDAELIAEgAkF/aiIGai0AAEEKRw0AIAJBfmohAgJAAkAgBg0AQQAhBwwBCyABQQAgASACai0AAEENRhshBwsgAiAGIAcbIQIgByABIAcbIQELIANB+ABqIAEgAhCbgICAAAJAAkAgAygCfCICRQ0AIAMoAnghASACQQVJDQECQAJAAkACQAJAAkACQAJAAkACQAJAAkAgASgAAEHnwrmjB3MgAUEEaiIGLQAAQfQAc3JFDQAgAkEFRg0NIAEoAABB9NLR4wZzIAYvAABB5cAAc3JFDQEgAkEISQ0NIAEpAABC88qNo5ftm7cgUg0NIANB8ABqIAFBCGogAkF4ahCbgICAAEEAIQEgAygCdCICQQBIDQMgAg0CQQEhCAwFCyADQeAAaiABQQVqIAJBe2oQm4CAgAAgAygCZCICQQZJDQsgAygCYCIBKAAAQfTS0eMGcyABQQRqLwAAQeXAAHNyDQsgA0HYAGogAUEGaiACQXpqEJuAgIAAQQAhAiADKAJcIglBAEgNByAJDQZBASEKDAoLIANB6ABqIAFBBmogAkF6ahCbgICAAEEAIQICQCADKAJsIglBAEgNAAJAIAkNAEEBIQsMCgsgAygCaCEBEJiBgIAAQQEhAiAJQQEQlYGAgAAiCw0FIAkhCwsgAiALEOmCgIAAAAsgAygCcCEGEJiBgIAAQQEhASACQQEQlYGAgAAiCA0BIAIhCAsgASAIEOmCgIAAAAsgAkUNACAIIAYgAvwKAAALAkAgAygClAEiBiADKAKMAUcNACADQYwBahDvgICAAAsgAygCkAEgBkEYbGoiAUEANgIUIAFCgICAgMAANwIMIAEgAjYCCCABIAg2AgQgASACNgIAIAMgBkEBajYClAEMBgsgCUUNAyALIAEgCfwKAAAMAwsgAygCWCEBEJiBgIAAQQEhAiAJQQEQlYGAgAAiCg0BIAkhCgsgAiAKEOmCgIAAAAsgCUUNASAKIAEgCfwKAAAMAQsCQCAEQQFIDQAgDCAEQQEQloGAgAALIAshDCAJIQQMAQsCQCAEQQFIDQAgDCAEQQEQloGAgAALIAohDCAJIQQLIANBCGogA0GYAWoQ9YCAgAAgAygCDCECIAMoAggiAUUNAgwBCyADQQE7AeQBIAMgAjYC4AEgA0EANgLcASADQQE6ANgBIANBOjYC1AEgAyACNgLQASADQQA2AswBIAMgAjYCyAEgAyABNgLEASADQTo2AsABIANB0ABqIANBwAFqEPaAgIAAAkAgAygCUCICRQ0AIANByABqIAIgAygCVBCbgICAAEEAIQECQAJAIAMoAkwiAkEASA0AIAJFDQIgAygCSCEHEJiBgIAAQQEhASACQQEQlYGAgAAiBg0BCyABIAIQ6YKAgAAACwJAIAJFDQAgBiAHIAL8CgAACyADQcAAaiADQcABahD2gICAACADQThqIAMoAkAiAUEBIAEbIAMoAkRBACABGxCbgICAACADKAI4IQcgAygCPCEBIAMgAjYC8AEgAyAGNgLsASADIAI2AugBIANBfzYCjAIgA0KAgICAcDcC/AEgA0KAgICAwAA3AvQBIANBATsBvAIgAyABNgK4AiADQQA2ArQCIANBAToAsAIgA0EsNgKsAiADIAE2AqgCIANBADYCpAIgAyABNgKgAiADIAc2ApwCIANBLDYCmAIDQCADQTBqIANBmAJqEPaAgIAAAkACQAJAAkACQAJAAkACQAJAIAMoAjAiAkUNACADQShqIAIgAygCNBCbgICAACADKAIsIgJFDQkgAygCKCEGAkACQAJAAkACQCACQQNJDQAgBi8AAEHpyAFzIAZBAmotAABBPXNyQf//A3FFDQEgAkEDRg0DIAYoAABB5OrJ6wNGDQIgAkEGSQ0AIAYoAABB4czRqwZzIAZBBGov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AgggACACNgIEIAAgATYCAAwLCyADQRBqIAIgARCCgYCAAAJAIAMoAhBBf0YNACADIAMpAiA3AqwBIAMgAykCGDcCpAEgAyADKQIQNwKcASADQYKAgIB4NgKYARCYgYCAAEGAAUEBEJWBgIAAIgJFDQQgA0EANgL4ASADIAI2AvQBIANBgAE2AvABIAMgA0HwAWo2AvwBAkAgA0GYAWogA0H8AWoQyoCAgAAiAkUNACADKALwASIBRQ0JIAMoAvQBIAFBARCWgYCAAAwJCyADKAL0ASECIAMoAvABIgFBf0YNCCAAIAMoAvgBNgIIIAAgAjYCBCAAIAE2AgAMCQsgAEF/NgIADA4LIANBEGogAiABEIGBgIAAAkAgAygCEEF/Rg0AIAMgAykCIDcCrAEgAyADKQIYNwKkASADIAMpAhA3ApwBIANBgYCAgHg2ApgBEJiBgIAAQYABQQEQlYGAgAAiAkUNBCADQQA2AvgBIAMgAjYC9AEgA0GAATYC8AEgAyADQfABajYC/AECQCADQZgBaiADQfwBahDKgICAACICRQ0AIAMoAvABIgFFDQYgAygC9AEgAUEBEJaBgIAADAYLIAMoAvQBIQIgAygC8AEiAUF/Rg0FIAAgAygC+AE2AgggACACNgIEIAAgATYCAAwGCyAAQX82AgAMDQtBAUGAARDpgoCAAAALQQFBgAEQ6YKAgAAAC0EBQYABEOmCgIAAAAtBAUGAARDpgoCAAAALIABBfzYCAAJAAkACQCACKAIADgIAAQILIAIoAggiAEUNASACKAIEIABBARCWgYCAAAwBCyACLQAEQQNHDQAgAkEIahCqg4CAAAsgAkEUQQQQloGAgAALIANBmAFqEMKAgIAADAcLIABBfzYCAAJAAkACQCACKAIADgIAAQILIAIoAggiAEUNASACKAIEIABBARCWgYCAAAwBCyACLQAEQQNHDQAgAkEIahCqg4CAAAsgAkEUQQQQloGAgAALIANBmAFqEMKAgIAADAULIABBfzYCAAJAAkACQCACKAIADgIAAQILIAIoAggiAEUNASACKAIEIABBARCWgYCAAAwBCyACLQAEQQNHDQAgAkEIahCqg4CAAAsgAkEUQQQQloGAgAALIANBmAFqEMKAgIAADAMLIABBfzYCAAJAAkACQCACKAIADgIAAQILIAIoAggiAEUNASACKAIEIABBARCWgYCAAAwBCyACLQAEQQNHDQAgAkEIahCqg4CAAAsgAkEUQQQQloGAgAALIANBmAFqEMKAgIAADAELIABBfzYCAAsgA0GAAmokgICAgAAL6RQBEX8jgICAgABB4AFrIgMkgICAgAAgA0EANgJcIANCgICAgMAANwJUIANBADYCaCADQoCAgIDAADcCYCADQQA7AZABIAMgAjYCjAEgA0EANgKIASADQQE6AIQBIANBCjYCgAEgAyACNgJ8IANBADYCeCADIAI2AnQgAyABNgJwIANBCjYCbCADQcgAaiADQewAahD1gICAAAJAIAMoAkgiAUUNACADQaABakEMaiEEIAMoAkwhAkEAIQVBBCEGA0ACQAJAIAINAEEAIQIMAQsgASACQX9qIgdqLQAAQQpHDQAgAkF+aiECAkACQCAHDQBBACEIDAELIAFBACABIAJqLQAAQQ1GGyEICyACIAcgCBshAiAIIAEgCBshAQsgA0HAAGogASACEJuAgIAAIAMoAkAhCAJAAkACQAJAAkACQCADKAJEIgkOAgMBAAsgCC8AAEGlygBGDQICQAJAIAlBD0kNACAIKQAAQvPKxavXzNux5QCFIAhBB2opAABC5Yili/bM3LDtAIWEUEUNAQwECyAJQQxJDQELIAgpAABC8MLJo5ft2LTwAIUgCEEIajUAAELh3NGDAoWEUA0BCyOBgICAAEH43cKAAGohAkEAIQEDQCABIgdBDGohAQJAAkACQANAIANBoAFqIAggCSACKAIAIAIoAgQiChCPg4CAACADQZQBaiADQaABahCAgYCAAAJAIAMoApQBQQFHDQAgAygCmAEiB0UNBCAHIAlJDQIgByAJRw0DDAQLI4GAgIAAQfjdwoAAaiAHQQxqIgdqIQIgAUEMaiIBQTxHDQAMCAsLIAggB2osAABBv39KDQELIAggCUEAIAcjgYCAgABBqN7CgABqEJGDgIAAAAsgA0EwaiAIIAcQm4CAgABBACELAkACQAJAIAMoAjQiDEEASA0AAkAgDA0AQQEhDQwDCyADKAIwIQ4QmIGAgABBASELIAxBARCVgYCAACINDQEgDCENCyALIA0Q6YKAgAAACyAMRQ0AIA0gDiAM/AoAAAsCQCAHIApqIgdFDQACQAJAIAkgB0sNACAJIAdGDQIMAQsgCCAHaiwAAEG/f0oNAQsgCCAJIAcgCSOBgICAAEG43sKAAGoQkYOAgAAACyADQQE2AsgBIANBATsBxAEgA0EANgK8ASADQQE6ALgBIANBOjYCtAEgA0EANgKsASADQTo2AqABIAMgCSAHayIKNgLAASADIAo2ArABIAMgCjYCqAEgAyAIIAdqNgKkASADQShqIANBoAFqEPaAgIAAAkAgAygCKCIHDQAgDEUNBSANIAxBARCWgYCAAAwFCyADQSBqIAcgAygCLBCbgICAAEEAIQoCQAJAAkAgAygCJCIHQQBIDQBBASELAkAgBw0AQQEhDwwDCyADKAIgIQ4QmIGAgABBASEKIAdBARCVgYCAACIPDQEgByEPCyAKIA8Q6YKAgAAACyAHRQ0AIA8gDiAH/AoAAAsCQAJAAkACQCADKALIASIKDgIDAQALIAMgCkF/ajYCyAEgA0EYaiADQaABahD2gICAACADKAIcIQogAygCGCEODAELQQAhDiADQQA2AsgBAkAgAy0AxQFFDQAMAQsgA0EBOgDFAQJAAkAgAy0AxAFBAUcNACADKALAASEQIAMoArwBIREMAQsgAygCwAEiECADKAK8ASIRRg0BCyADKAKkASARaiEOIBAgEWshCgsCQCAODQBBACEKDAELIA4hCwsgA0EQaiALIAoQm4CAgABBACELAkACQAJAAkAgAygCFCIKQQBIDQAgCkUNASADKAIQIQ4QmIGAgABBASELIApBARCVgYCAACISDQIgCiESCyALIBIQ6YKAgAAAC0EBIRIgDEUNASAHRQ0BDAULAkAgCkUNACASIA4gCvwKAAALAkAgDEUNACAHDQULIBIgCkEBEJaBgIAACwJAIAdFDQAgDyAHQQEQloGAgAALAkAgDEUNACANIAxBARCWgYCAAAsjgYCAgABB+N3CgABqIAFqIQIgAUEwRw0ADAQLCyADQThqIAhBDGogCUF0ahCbgICAAEEAIQICQAJAIAMoAjwiAUEASA0AAkAgAQ0AQQEhEwwDCyADKAI4IQcQmIGAgABBASECIAFBARCVgYCAACITDQEgASETCyACIBMQ6YKAgAAACwJAIAFFDQAgEyAHIAH8CgAACyADKAJYIQkCQAJAIAMoAlwiCEUNACAIQQxsIQcgCUEEaiECA0ACQCACQQRqKAIAIAFHDQAgAigCACATIAEQzoKAgABFDQMLIAJBDGohAiAHQXRqIgcNAAsLAkAgCCADKAJURw0AIANB1ABqEIaCgIAAIAMoAlghCQsgCSAIQQxsaiICIAE2AgggAiATNgIEIAIgATYCACADIAhBAWo2AlwMAQsgEyABQQEQloGAgAALIAMgA0HsAGoQ9YCAgAAgAygCBCECIAMoAgAiAQ0CDAMLIAMgAi0ACDoAxAEgAyAKNgLAASADIBI2ArwBIAMgCjYCuAEgAyAHNgK0ASADIA82ArABIAMgBzYCrAEgAyAMNgKoASADIA02AqQBIAMgDDYCoAECQAJAAkACQCADKAJcIgJFDQAgAkEMbCEJIAMoAlghAkEAIQEDQAJAIAIgAWoiCEEIaigCACAMRw0AIAhBBGooAgAgDSAMEM6CgIAADQAgAiAJaiEBDAMLIAkgAUEMaiIBRw0ACwsgA0GUAWogA0GgAWoQ74KAgAACQCADKAJcIgIgAygCVEcNACADQdQAahCGgoCAAAsgAygCWCACQQxsIgdqIgEgAygCnAE2AgggASADKQKUATcCACADIAJBAWoiAjYCXCACRQ0BIAcgAygCWCICakEMaiEBIAMoArQBIQcgAygCsAEhDwsDQAJAIAJBCGooAgAgB0cNACACQQRqKAIAIA8gBxDOgoCAAEUNAwsgAkEMaiICIAFHDQALCyADQZQBaiAEEO+CgIAAAkAgAygCXCICIAMoAlRHDQAgA0HUAGoQhoKAgAALIAMoAlggAkEMbGoiASADKAKcATYCCCABIAMpApQBNwIAIAMgAkEBajYCXAsCQCAFIAMoAmBHDQAgA0HgAGoQ7oCAgAAgAygCZCEGCyAGIAVBKGxqIgIgAykCoAE3AgAgAiADKQLAATcCICACIAMpArgBNwIYIAIgAykCsAE3AhAgAiADKQKoATcCCCADIAVBAWoiBTYCaAsgA0EIaiADQewAahD1gICAACADKAIMIQIgAygCCCIBDQALCwJAAkAgAygCXEUNACAAIAMpAlQ3AgAgAyADKAJcNgKoASADIAMpAmA3AqwBIAAgAykDqAE3AgggAyADKAJoNgK0ASAAIAMpA7ABNwIQDAELIABBfzYCACADQeAAahC/gICAACADKAJYIQgCQCADKAJcIgFFDQAgCCECA0ACQCACKAIAIgdFDQAgAkEEaigCACAHQQEQloGAgAALIAJBDGohAiABQX9qIgENAAsLIAMoAlQiAkUNACAIIAJBDGxBBBCWgYCAAAsgA0HgAWokgICAgAAL9yQFD38Cfg1/AnwHfyOAgICAAEGAA2siAySAgICAABCYgYCAAAJAAkBBMEEEEJWBgIAAIgRFDQBBfyEFIARBfzYCJCAEQX82AhggBEF/NgIMIARBfzYCAEEAIQYgA0EANgLEASADQoCAgICAATcCvAEgA0EAOwHsASADIAI2AugBIANBADYC5AFBASEHIANBAToA4AEgA0EKNgLcASADIAI2AtgBIANBADYC1AEgAyACNgLQASADIAE2AswBIANBCjYCyAEjiYCAgAAhAiADQbABaiADQcgBahD1gICAAAJAIAMoArABIgENAEEAIQhBACEJQQEhCkEAIQtBACEMQQEhDUEAIQ5BACEPQQEhEEEAIREMAgsgAq1CIIYiEiADQfQCaq2EIRMgEiADQccCaq2EIRIgAygCtAEhAkF/IQVBACERQQEhEEEAIQ9BACEOQQEhDUEAIQxBACELQQEhCkEAIQlBACEIQQEhB0EAIQYDQAJAAkAgAg0AQQAhAgwBCyABIAJBf2oiFGotAABBCkcNACACQX5qIQICQAJAIBQNAEEAIRUMAQsgAUEAIAEgAmotAABBDUYbIRULIAIgFCAVGyECIBUgASAVGyEBCyADQagBaiABIAIQm4CAgAACQCADKAKsASIBRQ0AIAMoAqgBIhYtAABBJUYNAAJAAkACQAJAAkACQAJAIAFBDUkNACAWKQAAQvHqhaOmrpi39ACFIBZBBWopAABC4dzRm4StmLn0AIWEUEUNASADQaABaiAWQQ1qIAFBc2oQm4CAgAAgAygCpAEiAkUNB0EAIQECQCACQQBIDQAgAygCoAEhFBCYgYCAAEEBIQEgAkEBEJWBgIAAIhcNBCACIRcLIAEgFxDpgoCAAAALIAFBBkkNAQsgFigAAEH00tHjBnMgFkEEai8AAEHlwABzckUNBCABQQdJDQAgFigAAEH42oTDB3MgFkEDaiICKAAAQfjSzYMCc3JFDQMgFigAAEH52oTDB3MgAigAAEH40s2DAnNyRQ0CC0EAIRhBASEUIAQhFQNAIAMgFDoAxwIgAyASNwPIAiADQfABaiOBgICAACIZQZOcwIAAaiADQcgCahDugoCAACADKALwASEa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IgYgASgCEEcNACABQRBqEKOAgIAACyABKAIUIAZBFGxqIgMgDDYCECADQQA2AgggAyAHNgIEIANBgQ47AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEGs1sKAAGoQhIOAgAAACyOBgICAACIBQZGfwIAAakEoIAFBvNbCgABqEPaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEHQQAgCiABKAJ8IAlLGxCmgICAAAsgACABNgIEIAAgAzYCACACQSBqJICAgIAAC/AmARB/I4CAgIAAQfABayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCjgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQCABQQEQooGAgABFDQAgASgCGCEMIAIgASgCjAE2AqgBIAIgASkChAE3A6ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQZgBaiABENyAgIAAIAIoApwBIQECQCACKAKYAUEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQZABaiABELaAgIAAIAIoApQBIQECQCACKAKQAUEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQYgBaiABELaAgIAAIAIoAowBIQECQCACKAKIASIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkGAAWogARC2gICAACACKAKEASEBAkAgAigCgAEiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAAgAkH4AGogARDbgICAACACKAJ8IQEgAigCeEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQAJAIAFBARCigYCAAEUNACACQfAAaiABELaAgIAAIAIoAnQhAQJAIAIoAnBBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHoAGogARC2gICAACACKAJsIQECQCACKAJoIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQeAAaiABELaAgIAAIAIoAmQhAQJAIAIoAmAiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAAgAkHYAGogARDcgICAACACKAJcIQEgAigCWEEBcQ0AAkAgAUEBEKKBgIAADQBBASELDAELIAEoAhghDiACIAEoAowBNgK4ASACIAEpAoQBNwOwASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgACQCABQQEQooGAgABFDQBBASEDAkAgAUEBEKKBgIAARQ0AIAEoAhghECACIAFBhAFqIgsoAgg2AsgBIAIgCykCADcDwAEgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQqoCAgAALQQEhAyABIA9BAWo2AlQgASgCUCAPQQN0aiIPIA02AgQgDyANNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghDyACIAsoAgg2AtgBIAIgCykCADcD0AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgACQAJAIAFBARCigYCAAEUNACACQdAAaiABELaAgIAAIAIoAlQhAQJAIAIoAlBBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkHIAGogARC2gICAACACKAJMIQECQCACKAJIIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCALQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQcAAaiABELaAgIAAIAIoAkQhAQJAIAIoAkAiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACyALQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAAgAkE4aiABENuAgIAAIAIoAjwhASACKAI4QQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBMGogARC2gICAACACKAI0IQECQCACKAIwQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJBKGogARC2gICAACACKAIsIQECQCACKAIoIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCALQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQSBqIAEQtoCAgAAgAigCJCEBAkAgAigCICILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIAtBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAACACQRhqIAEQ3ICAgAAgAigCHCEBIAIoAhghAwsCQCADQQFHDQAgASACKALIATYCjAEgASACKQPAATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALQQEhCwJAAkAgA0EBcUUNACADIQsMAQsgAUEBEKKBgIAARQ0AIAJBEGogARDagICAACACKAIUIQECQCACKAIQQQFxDQADQCACQQhqIAEQ2oCAgAAgAigCDCEBIAIoAghBAXFFDQALCyABLQAMQQJHIQsLAkAgC0EBRw0AIAEtAAxBAkcNAQtBACELCwJAIAtBAUcNACABIAIoArgBNgKMASABIAIpA7ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCALQQFHDQAgASACKAKoATYCjAEgASACKQOgATcChAECQCAMIAEoAhhLDQAgASAMNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALQQEhAyABLQCUASENAkACQAJAAkACQAJAIAtBAUcNACANQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYC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AUEANgIkCwJAIAMgASgCHEcNACABQRxqEKWAgIAACyABIANBAWo2AiQgASgCICADakENOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQQ1BACAKIAEoAnwgCUsbEKaAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDEH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQwCQCABKAIYIgYgASgCEEcNACABQRBqEKOAgIAACyABKAIUIAZBFGxqIgMgDDYCECADQQA2AgggAyAHNgIEIANBgRo7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEGs1sKAAGoQhIOAgAAACyOBgICAACIBQZGfwIAAakEoIAFBvNbCgABqEPaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakENQQAgCiABKAJ8IAlLGxCmgICAAAsgACABNgIEIAAgAzYCACACQSBqJICAgIAAC5MpARF/I4CAgIAAQeABayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCjgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCgJAAkACQAJAAkACQAJAAkAgAUEBEKKBgIAARQ0AIAEoAhghCyACIAEoAowBNgKIASACIAEpAoQBNwOAASABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAtBASEDIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gDDYCBCANIAw2AgACQCABQQEQooGAgABFDQAgASgCGCEOIAIgAUGEAWoiAygCCDYCmAEgAiADKQIANwOQASABKAI8IQ0CQCABKAJUIg8gASgCTEcNACABQcwAahCqgICAAAtBASEMIAEgD0EBajYCVCABKAJQIA9BA3RqIg8gDTYCBCAPIA02AgACQCABQQEQooGAgABFDQAgASgCGCEQIAIgAygCCDYCuAEgAiADKQIANwOwASABKAI8IQ0CQCABKAJUIg8gASgCTEcNACABQcwAahCqgICAAAtBASEMIAEgD0EBajYCVCABKAJQIA9BA3RqIg8gDTYCBCAPIA02AgACQCABQQEQooGAgABFDQAgASgCGCEPIAIgAygCCDYCyAEgAiADKQIANwPAASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJB+ABqIAEQs4CAgAAgAigCfCEBAkAgAigCeEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghESACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQfAAaiABELOAgIAAIAIoAnQhAQJAIAIoAnAiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCERIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB6ABqIAEQs4CAgAAgAigCbCEBAkAgAigCaCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAsgBNgKMASABIAIpA8ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAACACQeAAaiABENmAgIAAIAIoAmQhASACKAJgIQwLAkAgDEEBRw0AIAEgAigCuAE2AowBIAEgAikDsAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAAC0EBIQMCQCAMQQFGDQACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AqgBIAIgASkChAE3A6ABIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAAC0EBIQMgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAIAFBARCigYCAAEUNAEEBIQwCQCABQQEQooGAgABFDQAgASgCGCERIAIgAUGEAWoiAygCCDYCuAEgAiADKQIANwOwASABKAI8IQ0CQCABKAJUIhAgASgCTEcNACABQcwAahCqgICAAAtBASEMIAEgEEEBajYCVCABKAJQIBBBA3RqIhAgDTYCBCAQIA02AgACQCABQQEQooGAgABFDQAgASgCGCEQIAIgAygCCDYCyAEgAiADKQIANwPAASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJB2ABqIAEQs4CAgAAgAigCXCEBAkAgAigCWEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghEiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQdAAaiABELOAgIAAIAIoAlQhAQJAIAIoAlAiA0EBRw0AIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgEiABKAIYSw0AIAEgEjYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCESIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJByABqIAEQs4CAgAAgAigCTCEBAkAgAigCSCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCASIAEoAhhLDQAgASASNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAsgBNgKMASABIAIpA8ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAACACQcAAaiABENmAgIAAIAIoAkQhASACKAJAIQwLAkAgDEEBRw0AIAEgAigCuAE2AowBIAEgAikDsAE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAAC0EBIQMCQAJAIAxBAXFFDQAgDCEDDAELIAFBARCigYCAAEUNACACQThqIAEQ2ICAgAAgAigCPCEBAkAgAigCOEEBcQ0AA0AgAkEwaiABENiAgIAAIAIoAjQhASACKAIwQQFxRQ0ACwsgAS0ADEECRyEDCwJAIANBAUcNACABLQAMQQJHDQELQQAhAwsCQCADQQFHDQAgASACKAKoATYCjAEgASACKQOgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALAkAgA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCsgICAAAwBCyABQTRqEK2AgIAACwJAIANBAXENACABQQEQooGAgABFDQAgASgCGCENIAIgASgCjAE2AsgBIAIgASkChAE3A8ABIAEoAjwhAwJAIAEoAlQiDCABKAJMRw0AIAFBzABqEKqAgIAACyABIAxBAWo2AlQgASgCUCAMQQN0aiIMIAM2AgQgDCADNgIAAkAgAUEBEKKBgIAARQ0AIAJBKGogARCzgICAACACKAIsIQECQCACKAIoQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDCABKAJMRw0AIAFBzABqEKqAgIAACyABIAxBAWo2AlQgASgCUCAMQQN0aiIMIAM2AgQgDCADNgIAIAJBIGogARCzgICAACACKAIkIQECQCACKAIgIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIgwgASgCTEcNACABQcwAahCqgICAAAsgASAMQQFqNgJUIAEoAlAgDEEDdGoiDCADNgIEIAwgAzYCACACQRhqIAEQs4CAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIANBAUcNAAsLIAEtAAxBAkYNBAsgAS0ADEECRg0DCyABIAIoAsgBNgKMASABIAIpA8ABNwKEAQJAIA0gASgCGEsNACABIA02AhgLIAFBNGoQrICAgAALIAEgAigCiAE2AowBIAEgAikDgAE3AoQBAkAgCyABKAIYSw0AIAEgCzYCGAsgAUE0ahCsgICAAAsCQCABQQEQooGAgABFDQAgASgCGCENIAIgASgCjAE2AsgBIAIgASkChAE3A8ABIAEoAjwhAwJAIAEoAlQiDCABKAJMRw0AIAFBzABqEKqAgIAACyABIAxBAWo2AlQgASgCUCAMQQN0aiIMIAM2AgQgDCADNgIAAkAgAUEBEKKBgIAARQ0AIAJBEGogARCzgICAACACKAIUIQECQCACKAIQQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCELIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDCABKAJMRw0AIAFBzABqEKqAgIAACyABIAxBAWo2AlQgASgCUCAMQQN0aiIMIAM2AgQgDCADNgIAIAJBCGogARCzgICAACACKAIMIQECQCACKAIIIgNBAUcNACABIAIoAtgB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KAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAIAFBARCigYCAAEUNACACQcgAaiABELaAgIAAIAIoAkwhAQJAIAIoAkhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIRAgAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQqoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHAAGogARC2gICAACACKAJEIQECQCACKAJAIgNBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghECACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQThqIAEQtoCAgAAgAigCPCEBAkAgAigCOCIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAwsgAS0ADEECRg0CCyABIAIoAogBNgKMASABIAIpA4ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAALIAEgAigCeDYCjAEgASACKQNwNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQrICAgAAMAQsgAUE0aiIDEK2AgIAAIAMQrYCAgAAgAkEwaiABELmAgIAAIAIoAjQhASACKAIwQQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAEoAowBNgKIASACIAEpAoQBNwOAASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBKGogARC2gICAACACKAIsIQECQCACKAIoQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKqAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBIGogARC2gICAACACKAIkIQECQCACKAIgIgNBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRhqIAEQtoCAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKAKYATYCjAEgASACKQOQATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAogBNgKMASABIAIpA4ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQrICAgAAMAQsgAUE0ahCtgICAACACQRBqIAEQs4CAgAAgAigCFCEBAkAgAigCEEEBRw0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASABLQCUASIOQQFGOgCUASACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCqgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQQhqIAEQp4CAgAAgAigCCCEDIAIoAgwiASACKAKYATYCjAEgASACKQOQATcChAEgASAOOgCUASABQTRqEKyAgIAAIANBASABLQAMQQJGGyEDCyADQQFxDQELIAIgARCPgYCAACACKAIEIQEgAigCACELCwJAIAtBAUcNACABIAIoAmg2AowBIAEgAikDYDcChAECQCAMIAEoAhhLDQAgASAMNgIYCyABQTRqEKyAgIAADAELIAFBNGoQrYCAgAALQQEhAyABLQCUASENAkACQAJAAkACQAJAIAtBAUcNACANQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgBksNAiABIAQ2AjAMAgsgDUH/AXFBAUcNAyABLQCVAUUNBAJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiBmoiCyAITQ0AIAsgCGtBAUYNBwsCQCAFIAZLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQUgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahClgICAAAsgASgCLCADakECOgAAIAEgA0EBajYCMCABLQCUASENDAMLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKWAgIAACyABIANBAWo2AiQgASgCICADakECOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQQJBACAKIAEoAnwgCUsbEKaAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDUH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiILLQAADQEgCyADNgIEIAEoAowBIQYCQCABKAIYIgsgASgCEEcNACABQRBqEKOAgIAACyABKAIUIAtBFGxqIgMgBjYCECADQQA2AgggAyAHNgIEIANBgQQ7AQAgASALQQFqNgIYDAILIAcgAyOBgICAAEGs1sKAAGoQhIOAgAAACyOBgICAACIBQZGfwIAAakEoIAFBvNbCgABqEPaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakECQQAgCiABKAJ8IAlLGxCmgICAAAsgACABNgIEIAAgAzYCACACQaABaiSA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AQsgAkEQaiACQR9qI4GAgIAAQZOxwYAAakGdARDAgYCAACACQRBqEKeBgIAACyABQQA6AAAMAQsgAiABNgIMIAIgBSACQQxqrYQ3AxAgAkEEaiACQR9qI4GAgIAAQaGcwIAAaiACQRBqEMCBgIAAIAJBBGoQp4GAgAALIAJBIGokgICAgAALCQAQ1oGAgAAAC7wCAwJ/AX4BfyOAgICAAEEgayIDJICAgIAAEL2BgIAAIQQgACkCACEFIAMgAjYCGCADIAE2AhQgAyAFNwIMAkACQCOQgICAACgCACIGQQJLDQAgA0EMakEAELeBgIAADAELIAMgBkF4ajYCHCADQQxqIANBHGoQt4GAgAALAkACQAJAAkAgACgCCC0AAA4DAAECAwsgA0EMaiABIAIoAiRBABC+gYCAACADQQxqEKeBgIAADAILIANBDGogASACKAIkQQEQvoGAgAAgA0EMahCngYCAAAwBCyOBgICAAEGs4sKAAGoiAC0AACEGIABBADoAACAGRQ0AIANBDGogASOBgICAAEGTscGAAGpBnQEgAigCJBGBgICAAICAgIAAIANBDGoQp4GAgAALIARBADoAACADQSBqJICAgIAAC48BAQN/I4CAgIAAQRBrIgAkgICAgAAjgYCAgABBqerCgABqIgEtAAAhAiABQQE6AAAgACACOgAPAkAgAkEBRw0AQQAgAEEPaiOBgICAACIAQfuewIAAaiAAQbC0wYAAakHBACAAQeThwoAAahClgYCAAAALI4GAgIAAIQIgAEEQaiSAgICAACACQanqwoAAagtgAQF/I4CAgIAAQRBrIgQkgICAgAAgBCADOgAHIAQjkYCAgACtQiCGIARBB2qthDcDCCAAIAEjgYCAgABB2oTAgABqIARBCGogAhGBgICAAICAgIAAIARBEGokgICAgAALRwEBfyOAgICAAEEQayIAJICAgIAAIABBBGogAEEPaiOBgICAAEHhscGAAGpBhQEQwIGAgAAgAEEEahCngYCAABC7gYCAAAALuQEBAX8jgICAgABBEGsiBCSAgICAACAAQf8BOgAAIAQgATYCCCAEIAApAgA3AwAgBCOBgICAAEGs4MKAAGogAiADEPqCgIAAIQEgBC0AACEDAkACQAJAIAFFDQAgA0H/AXFB/wFHDQEjgYCAgAAiBEGGsMGAAGpBrQEgBEGE4MKAAGoQ+4KAgAAACyADQf8BcUEDRw0BIARBBHIQqoOAgAAMAQsgACAEKQMANwIACyAEQRBqJICAgIAAC+0CAQN/I4CAgIAAQcAAayIBJICAgIAAQf8BIQICQCAALQANDQBBASECI4GAgIAAQczpwoAAaigCAEEBSw0AENWBgIAAIQILIAEgAjoAGyABIAAoAgg2AhwgAUEQaiAAKAIAIAAoAgQQ14GAgAAgASABKQMQNwIgIAEgAUEbajYCMCABIAFBIGo2AiwgASABQRxqNgIoIAFBCGpBABDYgYCAAAJAAkACQCABKAIIQQFxDQAgASgCDCIADQELIAFBKGogAUE/aiOBgICAAEGw4sKAAGoQvIGAgAAMAQsjgYCAgAAhAiABQShqIABBCGoQ0IGAgAAiA0EEaiACQdjiwoAAahC8gYCAACADQQA6AAAgASAAENiBgIAAIAEoAgBBAXENACABKAIEIQAgAUEBNgI0IAEgADYCOCAARQ0AIAAgACgCACICQX9qNgIAIAJBAUcNACABQTRqQQRqELWBgIAACyABQcAAaiSAgICAAAtuAQF/I4CAgIAAQSBrIgIkgICAgAAgAiAAIAEQhYKAgAA2AgQgAiOPgICAAK1CIIYgAkEEaq2ENwMQIAJBCGogAkEfaiOBgICAAEGBncCAAGogAkEQahDAgYCAACACQQhqEKeBgIAAELuBgIAAAAtxAQF/I4CAgIAAQRBrIgIkgICAgAACQAJAAkAgAUEISw0AIAEgAE0NAQsgAkEANgIMIAJBDGogAUEEIAFBBEsbIAAQ5IKAgAAhAUEAIAIoAgwgARshAQwBCyAAENyCgIAAIQELIAJBEGokgICAgAAgAQsJABC7gYCAAAALCgAgABDfgoCAAAudAQECfyOAgICAAEEQayIEJICAgIAAAkACQAJAIAJBCEsNACACIANNDQELQQAhBSAEQQA2AgwgBEEMaiACQQQgAkEESxsgAxDkgoCAAA0BIAQoAgwiAkUNAQJAIAEgAyABIANJGyIDRQ0AIAIgACAD/AoAAAsgABDfgoCAACACIQUMAQsgACADEOKCgIAAIQULIARBEGokgICAgAAgBQs4AgF/AX4jgICAgABBEGsiASSAgICAACAAKQIAIQIgASAANgIMIAEgAjcCBCABQQRqELGBgIAAAAsNACABIAAQyYGAgAAACy8BAX8jgICAgABBEGsiAiSAgICAACACIAE2AgwgAiAANgIIIAJBCGoQr4GAgAAAC+8BAgN/AX4jgICAgABBEGsiAiSAgICAACABKAIEIQMgASgCACEEIAAtAAAhACACQQRqENSBgIAAIAIpAgghBQJAIAIoAgQiAUF/Rw0AIAVC/wGDQgNSDQAgAkEMahCqg4CAAAsCQAJAAkACQCAEI4GAgIAAQe+1wYAAakERIAMoAgwiAxGCgICAAICAgIAADQAgAEEBcQ0BIAQjgYCAgABBgLbBgABqQdgAIAMRgoCAgACAgICAAEUNAQtBASEEIAFBAEoNAQwCC0EAIQQgAUEATA0BCyAFpyABQQEQloGAgAALIAJBEGokgICAgAAgBAvwAgEDfyOAgICAAEEQayIAJICAgIAAI4GAgIAAQdjjwoAAaigCBCEBIABBADYCAAJAAkACQAJAIAAgARDDgoCAAA0AAkACQCAAKAIAIgINACOBgICAAEHY48KAAGooAgQhASAAQQA2AgAgACABEMOCgIAADQMgACgCACECQQAQxYKAgAANASACRQ0ECyOBgICAAEHY48KAAGoiASABKAIAIgEgAiABGzYCAAJAIAENACACIQEMBQsgAhDFgoCAAEUNBAsQzIGAgAAACyAAQQRqIABBD2ojgYCAgABB47fBgABqQd8AEMCBgIAAIABBBGoQp4GAgAAQu4GAgAAACyAAQQRqIABBD2ojgYCAgABB47fBgABqQd8AEMCBgIAAIABBBGoQp4GAgAAQu4GAgAAACyAAQQRqIABBD2ojgYCAgABBgLPBgABqQZsBEMCBgIAAIABBBGoQp4GAgAAQu4GAgAAACyAAQRBqJICAgIAAIAELRwEBfyOAgICAAEEQayIAJICAgIAAIABBBGogAEEPaiOBgICAAEGtt8GAAGpB7QAQwIGAgAAgAEEEahCngYCAABC7gYCAAAALOwACQAJAAkAgAC0ABA4DAgABAgsgACOCgICAAEGOgICAAGoQzoGAgAAgAEEAOgAEIAAPC0EAIQALIAAL7gIBBH8jgICAgABBIGsiAiSAgICAAAJAAkAjgYCAgABBqOPCgABqKAIADQAjgYCAgAAiA0Go48KAAGpBfzYCAAJAIANB2OPCgABqKAIAIgMNABDLgYCAACEDCwJAIANBARDGgoCAAA0AAkAjgYCAgABBqOPCgABqIgMoAgQiBCADKAIMIgVHDQAgAkEIaiOBgICAAEGo48KAAGpBBGogBBDSgYCAACACKAIIQX9HDQMjgYCAgABBqOPCgABqIgMoAgwiBSADKAIERw0AI4GAgIAAQajjwoAAakEEahDRgYCAAAsjgYCAgABBqOPCgABqIgMoAgggBUEDdGoiBCABNgIEIAQgADYCACADIAVBAWo2AgwgAyADKAIAQQFqNgIAIAJBIGokgICAgAAPCxDMgYCAAAALIAJBFGogAkEfaiOBgICAAEHYtsGAAGpBqwEQwIGAgAAgAkEUahCngYCAABC7gYCAAAALEL+BgIAAAAvxAgECfyOAgICAAEGgA2siAySAgICAAAJAAkACQAJAIAJB/wJLDQACQCACRQ0AIANBFGogASAC/AoAAAsgA0EUaiACakEAOgAAIANBlANqIANBFGogAkEBahCFg4CAAAJAIAMoApQDQQFHDQBBfiECIANBfjYCCCADI4GAgIAAQdDgwoAAaikDADcCDAwCCwJAIAMoApgDEMCCgIAAIgFFDQACQAJAIAEQ14KAgAAiAg0AQQEhBAwBCxCYgYCAACACQQEQlYGAgAAiBEUNBCACRQ0AIAQgASAC/AoAAAsgAyACNgIQIAMgBDYCDCADIAI2AggMAgtBfyECIANBfzYCCAwBCyADQQhqIAEgAhCzgYCAACADKAIIIQILAkAgAkF+Rg0AIAAgAykCDDcCBCAAIAI2AgAMAgsCQCADLQAMQQNHDQAgA0EQahCqg4CAAAsgAEF/NgIADAELQQEgAhDpgoCAAAALIANBoANqJICAgIAAC3MBAn8jgICAgABBEGsiASSAgICAACAALQAAIQIgAEEBOgAAIAEgAjoADwJAIAJBAUcNAEEAIAFBD2ojgYCAgAAiAEH7nsCAAGogAEGwtMGAAGpBwQAgAEHk4cKAAGoQpYGAgAAACyABQRBqJICAgIAAIAALTwEBfyOAgICAAEEQayIBJICAgIAAIAFBCGogACAAKAIAENKBgIAAAkAgASgCCCIAQX9GDQAgACABKAIMEOmCgIAAAAsgAUEQaiSAgICAAAucAQECfyOAgICAAEEQayIDJICAgIAAIANBBGogASgCACIEIAEoAgQgBEEBdCIEIAJBAWoiAiAEIAJLGyICQQQgAkEESxsiAhDTgYCAAAJAAkAgAygCBEUNACADKAIMIQEgAygCCCECDAELIAMoAgghBCABIAI2AgAgASAENgIEQX8hAgsgACABNgIEIAAgAjYCACADQRBqJICAgIAAC4QBAAJAIANB/////wFLDQAgA0EDdCIDQfz///8HSw0AAkACQCABRQ0AIAIgAxDigoCAACEBDAELIAMQ3IKAgAAhAQsCQCABDQAgACADNgIIIABBBDYCBCAAQQE2AgAPCyAAIAM2AgggACABNgIEIABBADYCAA8LIABBADYCBCAAQQE2AgALiwMBBn8jgICAgABBEGsiASSAgICAABCYgYCAAEGABCECAkACQAJAAkBBgARBARCVgYCAACIDRQ0AIAEgAzYCCCABQYAENgIEAkACQCADQYAEEJSCgIAADQBBgAQhAgNAI4GAgIAAIQQjkoCAgAAoAgAhBSOTgICAACgCACEGAkAgBSAEQbjhwoAAakYNACOBgICAAEG44cKAAGoQpYOAgAALIAZBxABHDQIgASACNgIMIAFBBGogAkEBQQFBARCugYCAACABKAIIIgMgASgCBCICEJSCgIAARQ0ACwsgASADENeCgIAAIgY2AgwgAiAGTQ0DAkAgBg0AQQEhBCADIAJBARCWgYCAAAwDCyADIAJBASAGEJeBgIAAIgQNAkEBIAYQ6YKAgAAACyAAQX82AgAgACAGrUIghjcCBCACRQ0DIAMgAkEBEJaBgIAADAMLQQFBgAQQ6YKAgAAACyABIAY2AgQgASAENgIICyAAIAEoAgw2AgggACABKQIENwIACyABQRBqJICAgIAAC6QCAQV/I4CAgIAAQRBrIgAkgICAgABBAyEBAkAjgYCAgABB9OnCgABqLQAAQX9qIgJB/wFxQQNJDQAgAEEEaiOBgICAAEGitMGAAGpBDhDPgYCAAAJAAkAgACgCBCIDQX9HDQBBAiECDAELAkACQAJAAkAgACgCDEF/ag4EAAICAQILIAAoAggiBC0AAEEwRw0BQQMhAUECIQIgAw0CDAMLIAAoAggiBCgAAEHm6rHjBkcNAEECIQFBASECIAMNAQwCC0EBIQFBACECIANFDQEgACgCCCEECyAEIANBARCWgYCAAAsjgYCAgABB9OnCgABqIgMgAy0AACIDIAEgAxs6AAAgA0UNACADQX9qQX8gA0EESRshAgsgAEEQaiSAgICAACACCwkAEJOCgIAAAAvyAQIDfwJ+I4CAgIAAQRBrIgMkgICAgAAgAyABIAIoAgwiBBGAgICAAICAgIAAQQQhAiABIQUCQAJAIAMpAwBC3Oyn/8XbgPu5f4UgAykDCELxg8Pjpr7Y4CSFhFANACADIAEgBBGAgICAAICAgIAAIAMpAwghBiADKQMAIQcjgYCAgAAhAgJAIAdCjfj6tPrEoZ7DAIUgBkLunPfC2aaA86R/hYRCAFENACACQZq1wYAAaiEBQQwhAgwCCyABQQRqIQVBCCECCyABIAJqKAIAIQIgBSgCACEBCyAAIAI2AgQgACABNgIAIANBEGokgICAgAAL6AEBA38jgICAgABBEGsiAiSAgICAAAJAAkACQCABDQAjgYCAgABBhOrCgABqLQAADQBBACEDDAELI4GAgIAAIgRBhOrCgABqQQE6AAAgAiABNgIMAkACQCAEQaTiwoAAaiIELQAERQ0AI4GAgIAAQaTiwoAAahDNgYCAACIERQ0BCyAEKAIAIQMgBCABNgIADAELAkAgAQ0AQQEhAQwCCyABIAEoAgAiBEF/ajYCAEEBIQECQCAEQQFHDQAgAkEMahC1gYCAAAsMAQtBACEBCyAAIAM2AgQgACABNgIAIAJBEGokgICAgAAL2gIBBX8jgICAgABBEGsiBCSAgICAAAJAAkAgA0UNACAEQQxqIQUDQAJAAkACQAJAAkBBAiACIAMQj4KAgAAiBkF/Rw0AI4GAgIAAIQcjkoCAgAAoAgAhCCOTgICAACgCACEGAkAgCCAHQbjhwoAAakYNACOBgICAAEG44cKAAGoQpYOAgAALIARBADoACyAEQQA7AAkgBCAGNgIMIARBADoACCAGEJ6DgIAAKAIIEYOAgIAAgICAgAANAyAEQQhqIQYMAQsgBEH/AToACCAEIAY2AgwjgYCAgAAhByAGDQEgB0GQ48KAAGohBgsgACAGKQIANwIADAULAkAgAyAGSQ0AIAIgBmohAiADIAZrIQMMAgsgBiADIAMjgYCAgABBkOTCgABqEPyCgIAAAAsgBC0ACEEDRw0AIAUQqoOAgAALIAMNAAsLIABB/wE6AAALIARBEGokgICAgAALZAECfyOUgICAACIBIAEoAgAiAkEBajYCAEEAIQECQCACQQBIDQBBASEBI4GAgIAAQczpwoAAai0ABA0AI4GAgIAAQczpwoAAaiIBIAA6AAQgASABKAIAQQFqNgIAQQIhAQsgAQscACAAKAIAIAEgACgCBCgCDBGEgICAAICAgIAACwoAIAAQioKAgAALwwEBAX8jgICAgABBkAhrIgIkgICAgAAgAkEAQYAI/AsAAkAgACACQYAIENaCgIAAQQBIDQAgAiACENeCgIAAQQFqNgKECCOVgICAACEAIAIgAjYCgAggAiAArUIghiACQYAIaq2ENwOICCOBgICAACEAIAEoAgAgASgCBCAAQdqEwIAAaiACQYgIahD6goCAACEBIAJBkAhqJICAgIAAIAEPCyOBgICAACICQZK4wYAAakElIAJBuOPCgABqEPuCgIAAAAsHACAAQRtGCy8BAX9BKyEBAkAgAEF/aiIAQcoASw0AI4GAgIAAQYG5wYAAaiAAai0AACEBCyABC+sCAQR/I4CAgIAAQRBrIgEkgICAgAACQCOBgICAAEGo48KAAGooAgANAANAI4GAgIAAQajjwoAAaiICQX82AgACQCACKAIMIgMNAEEAIQMCQCOBgICAAEGo48KAAGooAgRFDQAjgYCAgABBqOPCgABqIgIoAggQ34KAgAAgAigCAEEBaiEDCyOBgICAAEGo48KAAGoiAkEANgIMIAJCgICAgMAANwIEIAIgAzYCAAJAI5CAgIAAKAIAIgJBA0kNACOQgICAAEECNgIAIAJBeGoiAiACKAIAIgNBf2o2AgAgASACNgIMIANBAUcNACABQQxqEKuBgIAACyABQRBqJICAgIAADwsjgYCAgABBqOPCgABqIgIgA0F/aiIDNgIMIAIoAgggA0EDdGoiAygCBCEEIAMoAgAhAyACQQA2AgAgAyAEEYWAgIAAgICAgAAgAigCAEUNAAsLI4GAgIAAQZjjwoAAahCWg4CAAAALJQEBfyAAI4GAgIAAQbSywYAAaiICKQIINwIIIAAgAikCADcCAAslAQF/IAAjgYCAgABBpLLBgABqIgIpAgg3AgggACACKQIANwIAC8EBBAN/AX4CfwF+QQAhAwJAIAJBACAAKAIIIgQoAgQiBSAEKQMIIgZC/////w8gBkL/////D1Qbp2siByAHIAVLGyIHIAIgB0kbIghFDQAgBCgCACAGIAWtIgkgBiAJVBunaiABIAj8CgAACyAEIAYg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aiEBIAJBf2oiAg0ACwsgAEEAQQAQj4KAgAAPCyOTgICAAEEcNgIAQX8L5gECAX8CfiOAgICAAEEQayICJICAgIAAAkACQCABDQBBACEADAELAkAgACOWgICAAEcNAEEAIQAQtYKAgAAhAyABQQA2AgwgASADQoCU69wDgCIENwMAIAEgAyAEQoCU69wDfn0+AggMAQsCQCAAI5eAgIAARw0AIAIQt4KAgABBACEAIAFBADYCDCABQf+T69wDIAIoAgggAikDACIDQgBTGzYCCCABIANC////////////ACADQv///////////wBUGzcDAAwBCyOTgICAAEEcNgIAQX8hAAsgAkEQaiSAgICAACAAC/wBAgJ/AX4jgICAgABBMGsiAySAgICAAAJAAkAgACADQShqEJeCgIAAQQBODQBBfyEADAELAkACQAJAIAMoAiwiBCgCCCIARQ0AIAMoAiggA0EQaiAAEYSAgIAAgICAgABBAEgNASADQRBqIAEgAhCagoCAACEADAILAkAgBCgCRCIARQ0AIAMoAiggASACQQBBAEEAIAARhoCAgACAgICAACEADAILI5OAgIAAQTo2AgALQX8hAAsgAykDKCIFpyICIAIoAgBBf2oiAjYCACADIAU3AxAgAg0AIAMgAykDEDcDCCADQQhqEJiCgIAACyADQTBqJICAgIAAIAALPAEBfyOAgICAAEEQayIBJICAgIAAAkAgAEH/AUsNACAAEKiCgIAAAAsgAUEBOgAPIAFBD2oQp4KAgAAACyAAAkAjgYCAgABBrOXCgABqKAIAQX9HDQAQkoKAgAALC/0CAQx/I4CAgIAAQRBrIgAkgICAgAAjgYCAgAAhASAAQQhqEKaCgIAAAkACQAJAIAAoAgwiAg0AIAFBsOrCgABqIQMMAQsgAkEBaiIBRQ0BIAFBBBDhgoCAACIDRQ0BIAAoAgghASADIQRBACEFA0AgAUEIaigCACEGIAEoAgAhByAEIAFBDGooAgAiCCABQQRqKAIAIglqIgpBAmoQ3IKAgAAiCzYCAAJAIAsNAAJAIAVFDQAgAyEBA0AgASgCABDfgoCAACABQQRqIQEgBUF/aiIFDQALCyADEN+CgIAADAMLAkAgCUUNACALIAcgCfwKAAALIAsgCWoiCUE9OgAAAkAgCEUNACAJQQFqIAYgCPwKAAALIAsgCmpBAWpBADoAACABQRBqIQEgBEEEaiEEIAIgBUEBaiIFRw0ACyAAQQhqEJuCgIAACyOBgICAAEGs5cKAAGogAzYCACAAQRBqJICAgIAADwsgAEEIahCbgoCAAEHGABCQgoCAAAALAwAAC2oBAX8jgYCAgABBsOXCgABqKAIAIQICQAJAIAANACACENKCgIAAIgANASOTgICAAEEwNgIAQQAPCwJAIAEgAhDXgoCAAEEBak8NACOTgICAAEHEADYCAEEADwsgACACENGCgIAAIQALIAALwAEBBX8jgICAgABBEGsiASSAgICAACAAKAIAIgJBATYCAAJAAkAjgYCAgABBtOrCgABqLQAADQAjgYCAgABBtOrCgABqQQE6AABBfyEDELmCgIAAQX9KDQAgAiACKAIAQX9qIgQ2AgAgBA0BIAAoAgQhACOTgICAACIEKAIAIQUgAiAAKAIAEYWAgIAAgICAgAAgBCAFNgIADAELIAEgACkCADcDCCABQQhqEJaCgIAAIQMLIAFBEGokgICAgAAgAwuwAwMBfwF+BX8jgYCAgAAhASAAKQIAIQICQAJAAkACQAJAAkAgAUHA6sKAAGooAgAiACABQbzqwoAAaigCACIDTw0AI4GAgIAAQbjqwoAAaigCACAAQQxsaiEBA0AgAS0AAEEBRw0BIAFBDGohASADIABBAWoiAEcNAAwCCwsgACADRw0BC0F/IQAgA0EBaiIERQ0AIANBCCADGyEAA0AgACIBQQF0IQAgASAESQ0ACyOBgICAAEG46sKAAGooAgAgAUEMbBDigoCAACIARQ0BAkAgASOBgICAACIEQbzqwoAAaiIFKAIAIgZrQQxsIgdFDQAgACAGQQxsakEAIAf8CwALIAUgATYCACAEQbjqwoAAaiAANgIAIAMhAAsjgYCAgAAiAUHA6sKAAGogAEEBajYCACABQbjqwoAAaigCACAAQQxsaiIBIAI3AgQgAUEBOgAAIABBf0oNAgwBCyOTgICAAEEwNgIAC0F/IQAgAqciASABKAIAQX9qIgM2AgAgAw0AI5OAgIAAIgMoAgAhBCABIAJCIIinKAIAEYWAgIAAgICAgAAgAyAENgIACyAAC7kBAQF/AkAjgYCAgABBtOrCgABqLQAADQAjgYCAgABBtOrCgABqQQE6AAAQuYKAgABBAE4NAEF/DwsjgYCAgAAhAgJAAkAgAEEASA0AIAAgAkG86sKAAGooAgBJDQELI5OAgIAAQQg2AgBBfw8LAkAjgYCAgABBuOrCgABqKAIAIABBDGxqIgAtAAANACOTgICAAEEINgIAQX8PCyAAKAIEIgIgAigCAEEBajYCACABIAApAgQ3AgBBAAswAQJ/I5OAgIAAIgEoAgAhAiAAKAIAIAAoAgQoAgARhYCAgACAgICAACABIAI2AgAL6QIBBn8jgICAgABBIGsiAiSAgICAAAJAAkAgAUIAUg0AIAAQqYKAgABBACEADAELIAEQtoKAgAAhAyACIAA2AhggAiADEJ6CgIAANgIcIAJBAjYCFCACIAJBGGo2AhAgAkEQaiACQQhqEKqCgIAAIAMQnYKAgAACQAJAIAIoAgwiAEUNACAAQQNxIQRBACEFIAIoAgghBkEAIQMCQAJAIABBBEkNACAAQXxxIQdBACEDIAYhAEEAIQUDQCAAQQxqKAIARSAAQQhqKAIARXIgAEEEaigCAEVyIAAoAgBFciADciEDIABBEGohACAHIAVBBGoiBUcNAAsgBEUNAQsgBiAFQQJ0aiEAA0AgACgCAEUgA3IhAyAAQQRqIQAgBEF/aiIEDQALCyACQQhqEJ+CgIAAQQAhACADQQFxRQ0BDAILIAJBCGoQn4KAgAALI5OAgIAAQQY2AgBBfyEACyACQSBqJICAgIAAIAALtgMDAX8CfgJ/I4CAgIAAQSBrIgMkgICAgAACQAJAAkACQAJAAkADQAJAIAAoAhAgA0EQaiADQRhqEKuCgIAADQAgAy0AGEEBRw0CQcAAIQAMAwsCQCADKQMQIgRQDQAgAyAEIAKtIgUgBCAFVBsiBDcDECADIAQ+AgwgAyABNgIIAkAgACgCECADQQhqIANBGGoQrIKAgAANACADLQAYQQFHDQVBwAAhAAwGCyAALQAEQQFHDQYgACgCECADQRhqEK2CgIAADQYgAy0AGEEBRw0EQcAAIQAMBQsCQCAALQAEQQFGDQBBBiEADAMLAkAgACgCFCIGKAIAIgcNACAGIAAoAhAQroKAgAA2AgAgACgCFCgCACEHC0F/IQYgBxCegoCAACAAKQMIEJmCgIAAQX9KDQAMBgsLIAMoAhwQnIKAgABBHSEACyOTgICAACAANgIAQX8hBgwDCyADKAIcEJyCgIAAQR0hAAsjk4CAgAAgADYCAEF/IQYMAQsgAykDECIEpyIGQQFIDQAgACgCACIARQ0AIAAgACkDACAEQv////8Hg3w3AwALIANBIGokgICAgAAgBgt7AQJ/AkAgACgCBCIBRQ0AIAAoAgAiAiEAA0ACQCAAQQRqKAIARQ0AIAAoAgAQ34KAgAALIABCADcCAAJAIABBDGooAgBFDQAgAEEIaigCABDfgoCAAAsgAEEIakIANwIAIABBEGohACABQX9qIgENAAsgAhDfgoCAAAsLCgAgABCBgICAAAsKACAAEIKAgIAACwQAIAALGAACQCAAKAIERQ0AIAAoAgAQ34KAgAALCwoAIAAQg4CAgAALBAAgAAsKACAAEISAgIAACwQAIAALCgAgABCFgICAAAsKACAAEIaAgIAACzUBAX8jgICAgABBEGsiASSAgICAACABQQhqEIeAgIAAIAAgASkCCDcCACABQRBqJICAgIAACw4AIAAtAAAQiICAgAAACwsAIAAQiYCAgAAACwoAIAAQioCAgAALPwEBfyOAgICAAEEQayICJICAgIAAIAAoAgAgACgCBCACQQhqEIuAgIAAIAEgAikCCDcCACACQRBqJICAgIAAC3cCAX8BfiOAgICAAEEQayIDJICAgIAAIAAgAxCMgICAAAJAAkACQAJAIAMtAAAOAgACAQsgAykDCCEECyABIAQ3AwBBASEADAELIAIgAzUCDEIghkIAIAMxAAgiBFAbIASENwIAQQAhAAsgA0EQaiSAgICAACAAC1wBAX8jgICAgABBEGsiAySAgICAACAAIAEoAgAgASgCBCADQQRqEI2AgIAAAkAgAy0ABEEBRyIBDQAgAiADLQAIOgAAIAIgAygCDDYCBAsgA0EQaiSAgICAACABC1IBAX8jgICAgABBEGsiAiSAgICAACAAIAJBBGoQjoCAgAACQCACLQAEQQFHIgANACABIAItAAg6AAAgASACKAIMNgIECyACQRBqJICAgIAAIAALCgAgABCPgICAAAsIABCQgICAAAsIABCRgICAAAsIABCSgICAAAtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCTgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCUgICA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IAVBzICAgABqrUIghiAIQRBqrYQ3AyAjgYCAgABBzIPAgABqIAhBIGogBxD7goCAAAALFQAgACABQQF0QQFyIAIQ+4KAgAAAC9UDBAF/AX4DfwV+I4CAgIAAQSBrIgMkgICAgAAgAEL/DzcDCEIAIQQgAEIANwMAQQAhBQJAAkAgAUKqfVMNACACUA0AIAFCtAJVDQFCACEEIANBEGojn4CAgAAgAaciBkEEdGoiB0HgKmopAwBCACACIAJ5IgiGIglCABCxg4CAACADKQMQIQoCQCADKQMYIgJC/wODQv8DUg0AIAMgB0HoKmopAwBCACAJQgAQsYOAgAAgAykDCCIJIAp8IgogCVStIAJ8IQILAkAgAUIbfELTAFQNACAKQn9SDQBBfyEFDAELIAIgAkI/iCILQgl8IgyIIQkCQCAGQeqkDWxBEHUgCKdrIAunakE/aiIGQYJ4SA0AQYAIQf8HIAlC/P////////8AgyAJIAkgDIYgAlEbIAkgCUIDg0IBURsgCSAKQgJUGyAJIAFCBHxCHFQbIgFCAYMgAXwiAUL/////////H1YiBxsgBmoiBUH+D0sNAkIAIAFCAYhC//////////f/AIMgBxshBAwBCyAGQcN3SQ0AIAlBgnggBmutiCIBQgGDIAF8IgFC/////////w9WIQUgAUIBiCEECyAAIAU2AgggACAENwMACyADQSBqJICAgIAAC+cCBQJ/An4BfwF+An8jgICAgABBIGsiAiSAgICAAEEUIQMgACkDACIEIQUCQCAEQugHVA0AQRQhAyAEIQUDQCACQQxqIANqIgBBfGojgYCAgABBoezBgABqIgYgBSIHIAdCkM4AgCIFQpDOAH59pyIIQf//A3FB5ABuIglBAXRqLwAAOwAAIABBfmogBiAIIAlB5ABsa0H//wNxQQF0ai8AADsAACADQXxqIQMgB0L/rOIEVg0ACwsCQCAFQglYDQAgAkEMaiADQX5qIgNqI4GAgIAAQaHswYAAaiAFpyIAIABB//8DcUHkAG4iAEHkAGxrQf//A3FBAXRqLwAAOwAAIACtIQULAkACQCAEUA0AIAVQDQELIAJBDGogA0F/aiIDaiOBgICAAEGh7MGAAGogBadBAXRqLQABOgAACyABQQFBAUEAIAJBDGogA2pBFCADaxCJg4CAACEDIAJBIGokgICA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IAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEHG4cGAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELrwIBBX9BACEBI4GAgIAAQej1wYAAaiICIAJBAEEGIABBgPwDSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkEjIQQCQAJAIANBCksNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQfjpwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuvAgEFf0EAIQEjgYCAgABBmPbBgABqIgIgAkEAQQUgAEG9oQRJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQSshBAJAAkAgA0EJSw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABBm+rBgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC2YCAX8BfiOAgICAAEEgayIDJICAgIAAIAMgATYCDCADIAA2AgggAyOPgICAAK1CIIYiBCADQQhqrYQ3AxggAyAEIANBDGqthDcDECOBgICAAEHngMCAAGogA0EQaiACEPuCgIAAAAuqAwEEfwJAAkACQAJAAkACQAJAIAJBB0sNACACRQ0FIAEtAAANAUEAIQMMBgsgAUEDakF8cSIEIAFGDQEgBCABayEEQQAhAwNAIAEgA2otAABFDQYgBCADQQFqIgNHDQALIAQgAkF4aiIFSw0D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QRsgAEHbmQZJGyIDIANBDWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBB2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAmoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQYsMIQQCQAJAIANBNEsNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQYbIwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQvsAgEFf0EAIQEjgYCAgABBuPTBgABqIgIgAkEAQRYgAEHQrARJGyIDIANBC2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBBWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQacCIQQCQAJAIANBKksNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQdHnwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQugCgIKfwF+I4CAgIAAQZAGayIDJICAgIAAIANBBGpBAEGJBvwLAEEAIQQCQAJAIAJFDQAgA0EEakEIaiEFIANBBGohBkEAIQcgAiEEAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkADQAJAIAEgB2oiCC0AACIJQTBGDQAgCUFQaiIKQf8BcUEJSw0DIAEgB2ohCyAHQX9zIAJqIQhBACEJA0ACQCAJIgdB/wVLDQAgBSAHaiAKOgAACwJAIAggB0YNACAH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NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL2lvL2Vycm9yL3VuaXgucnMAL2NhcmdvL3JlZ2lzdHJ5LzI1Y2RkNTdmYWU5ZjA0NjIvaGFzaGJyb3duLTAuMTcuMS9zcmMvcmF3LnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy9zeXMvdGhyZWFkX2xvY2FsL2Rlc3RydWN0b3JzL2xpc3QucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3NoYXJlZC9zbWFsbHNvcnQucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC9zdGFibGUvcXVpY2tzb3J0LnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC9xdWFkcmFudC5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2FsbG9jL3NyYy9mbXQucnMAL2hvbWUvbGFiLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvaXRlcmF0b3JzL3BhaXJzLnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC90eXBlcy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvbXV0ZXgvbm9fdGhyZWFkcy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvcndsb2NrL25vX3RocmVhZHMucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL29uY2Uvbm9fdGhyZWFkcy5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvc3RyLnJzAC9ob21lL2xhYi8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2Vycm9yLnJzAC9ob21lL2xhYi8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlyLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbWVtY2hyLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvbnVtL2ltcC9kZWMyZmx0L2RlY2ltYWxfc2VxLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3N0ci9wYXR0ZXJuLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvc3RyL3BhdHRlcm4ucnMAL2hvbWUvbGFiLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvcG9zaXRpb24ucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL2NsYXNzX2RpYWdyYW0ucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9ob21lL2xhYi8uY2FyZ28vcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL3BhcnNlcl9zdGF0ZS5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2NvcmUvc3JjL251bS9pbXAvZGVjMmZsdC9wYXJzZS5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvcGllLnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC9zZXF1ZW5jZS5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvYnN0ci9tb2QucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9zdHIvbW9kLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMvbW9kLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvaWQucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS9yZXByX2lvdmVjLnJzAMABOgAvABFzdGFydCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAPZW5kIGJ5dGUgaW5kZXggwCYgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlIMAIIChieXRlcyDACyBvZiBzdHJpbmcpAAlxdWFkcmFudC3AASAAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMBHIGJ5dGVzIGZhaWxlZApza2lwcGluZyBiYWNrdHJhY2UgcHJpbnRpbmcgdG8gYXZvaWQgcG90ZW50aWFsIHJlY3Vyc2lvbgoANWZhdGFsIHJ1bnRpbWUgZXJyb3I6IGZhaWxlZCB0byBpbml0aWF0ZSBwYW5pYywgZXJyb3IgwAssIGFib3J0aW5nCgAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwA4gYnl0ZXMgZmFpbGVkCgAMcGFuaWNrZWQgYXQgwAI6CsAzCnRocmVhZCBwYW5pY2tlZCB3aGlsZSBwcm9jZXNzaW5nIHBhbmljLiBhYm9ydGluZy4KAAkKdGhyZWFkICfAAycgKMAOKSBwYW5pY2tlZCBhdCDAAjoKwAEKABlhYm9ydGluZyBkdWUgdG8gcGFuaWMgYXQgwAI6CsABCgB1bmtub3duIHBhcnNpbmcgZXJyb3JpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlAAAAAAAAAP//////////Y2FsbCBsaW1pdCByZWFjaGVkc3RhY2sgbGltaXQgcmVhY2hlZGF0dGVtcHQgdG8gam9pbiBpbnRvIGNvbGxlY3Rpb24gd2l0aCBsZW4gPiB1c2l6ZTo6TUFYVERCVExSUkxyZWN0cm91bmRlZGRpYW1vbmRjaXJjbGVpZGxhYmVsc2hhcGVhcnJvd2xpbmVzb3VyY2V0YXJnZXRlZGdlVHlwZWtpbmR2YXJpYW50ZGlyZWN0aW9ubm9kZXNlZGdlc3RpdGxleEF4aXNMZWZ0eEF4aXNSaWdodHlBeGlzQm90dG9teUF4aXNUb3BxdWFkcmFudHNwb2ludHNwYXJ0aWNpcGFudHNtZXNzYWdlc2Zyb210b3RleHRhcnJvd0tpbmRzb2xpZGRvdHRlZHNvbGlkLW9wZW5kb3R0ZWQtb3BlbnNsaWNlc3ZhbHVlc2VjdGlvbnNuYW1ldGFza3NkZXBzZHVyYXRpb252aXNpYmlsaXR5dHlwZUluZm9pc01ldGhvZGF0dHJpYnV0ZXNtZXRob2RzcmVsVHlwZWFycm93QXRjbGFzc2VzcmVsYXRpb25zaGlwc3h5QW55RGlhZ3JhbUdyYXBoZ3JhcGhQaWVwaWVHYW50dGdhbnR0U2VxdWVuY2VzZXF1ZW5jZUNsYXNzY2xhc3NRdWFkcmFudHF1YWRyYW50ZmFsc2UtLT5mbG93Y2hhcnRwb3NpdGlvbiBvdXQgb2YgYm91bmRzbWlkID4gbGVuwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrTIAAAaAQAAyB8IMABCsgAAAMgfCDICAABCsgAAAMgfArIAAADID0gyAkAAEZvcm1hdHRpbmcgYXJndW1lbnQgb3V0IG9mIHJhbmdlwAQtLT4gwMABOsABCsgAAAMgfArbIAAAaAQAAgADIHwgyAUAAQrIAAAHIHwgLi4uCtsgAABoBAAGAAMgfCDAAQrIAAADIHwgyAgAAQrIAAADIHwKyAAAAyA9IMgJAADABC0tPiDAwAE6wAEKyAAAAyB8CsgCAAMgfCDIBAABCsgAAAMgfCDIBQABCsgAAAMgfArIAAADID0gyAYAAHB1YmxpY3ByaXZhdGVwcm90ZWN0ZWRpbnRlcm5hbDx8LS1pbmhlcml0YW5jZSotLWNvbXBvc2l0aW9uby0tYWdncmVnYXRpb24uLnw+aW1wbGVtZW50cy4uPmRlcGVuZGVuY3kuLm5vbmU8LS1kaXJlY3RlZC1hc3NvY2lhdGlvbi0tYXNzb2NpYXRpb24tLT4+LT4+LT5FT0lmaWxlZGlhZ3JhbWt3c3RtdHNzdG10c3RtdF9pbm5lcmNvbW1lbnRjaGFpbm5vZGVkZWZucmVmbmlkY2lyY3JuZGRpYW1zdHh0ZWRnZWFycl9sYmxhcnJsbl9sYmxsbmxibGx0eHRzcG5sAAADBAcCCQUECgcFBwQDBQQEAwQEBAcDBgIDBAICdXV1dXV1dXVidG51ZnJ1dXV1dXV1dXV1dXV1dXV1dXUAACIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAxMjM0NTY3ODlhYmNkZWYFBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBWUtMzI0AAUAZS0zMjMABQBlLTMyMgAFAGUtMzIxAAUAZS0zMjAABQBlLTMxOQAFAGUtMzE4AAUAZS0zMTcABQBlLTMxNgAFAGUtMzE1AAUAZS0zMTQABQBlLTMxMwAFAGUtMzEyAAUAZS0zMTEABQBlLTMxMAAFAGUtMzA5AAUAZS0zMDgABQBlLTMwNwAFAGUtMzA2AAUAZS0zMDUABQBlLTMwNAAFAGUtMzAzAAUAZS0zMDIABQBlLTMwMQAFAGUtMzAwAAUAZS0yOTkABQBlLTI5OAAFAGUtMjk3AAUAZS0yOTYABQBlLTI5NQAFAGUtMjk0AAUAZS0yOTMABQBlLTI5MgAFAGUtMjkxAAUAZS0yOTAABQBlLTI4OQAFAGUtMjg4AAUAZS0yODcABQBlLTI4NgAFAGUtMjg1AAUAZS0yODQABQBlLTI4MwAFAGUtMjgyAAUAZS0yODEABQBlLTI4MAAFAGUtMjc5AAUAZS0yNzgABQBlLTI3NwAFAGUtMjc2AAUAZS0yNzUABQBlLTI3NAAFAGUtMjczAAUAZS0yNzIABQBlLTI3MQAFAGUtMjcwAAUAZS0yNjkABQBlLTI2OAAFAGUtMjY3AAUAZS0yNjYABQBlLTI2NQAFAGUtMjY0AAUAZS0yNjMABQBlLTI2MgAFAGUtMjYxAAUAZS0yNjAABQBlLTI1OQAFAGUtMjU4AAUAZS0yNTcABQBlLTI1NgAFAGUtMjU1AAUAZS0yNTQABQBlLTI1MwAFAGUtMjUyAAUAZS0yNTEABQBlLTI1MAAFAGUtMjQ5AAUAZS0yNDgABQBlLTI0NwAFAGUtMjQ2AAUAZS0yNDUABQBlLTI0NAAFAGUtMjQzAAUAZS0yNDIABQBlLTI0MQAFAGUtMjQwAAUAZS0yMzkABQBlLTIzOAAFAGUtMjM3AAUAZS0yMzYABQBlLTIzNQAFAGUtMjM0AAUAZS0yMzMABQBlLTIzMgAFAGUtMjMxAAUAZS0yMzAABQBlLTIyOQAFAGUtMjI4AAUAZS0yMjcABQBlLTIyNgAFAGUtMjI1AAUAZS0yMjQABQBlLTIyMwAFAGUtMjIyAAUAZS0yMjEABQBlLTIyMAAFAGUtMjE5AAUAZS0yMTgABQBlLTIxNwAFAGUtMjE2AAUAZS0yMTUABQBlLTIxNAAFAGUtMjEzAAUAZS0yMTIABQBlLTIxMQAFAGUtMjEwAAUAZS0yMDkABQBlLTIwOAAFAGUtMjA3AAUAZS0yMDYABQBlLTIwNQAFAGUtMjA0AAUAZS0yMDMABQBlLTIwMgAFAGUtMjAxAAUAZS0yMDAABQBlLTE5OQAFAGUtMTk4AAUAZS0xOTcABQBlLTE5NgAFAGUtMTk1AAUAZS0xOTQABQBlLTE5MwAFAGUtMTkyAAUAZS0xOTEABQBlLTE5MAAFAGUtMTg5AAUAZS0xODgABQBlLTE4NwAFAGUtMTg2AAUAZS0xODUABQBlLTE4NAAFAGUtMTgzAAUAZS0xODIABQBlLTE4MQAFAGUtMTgwAAUAZS0xNzkABQBlLTE3OAAFAGUtMTc3AAUAZS0xNzYABQBlLTE3NQAFAGUtMTc0AAUAZS0xNzMABQBlLTE3MgAFAGUtMTcxAAUAZS0xNzAABQBlLTE2OQAFAGUtMTY4AAUAZS0xNjcABQBlLTE2NgAFAGUtMTY1AAUAZS0xNjQABQBlLTE2MwAFAGUtMTYyAAUAZS0xNjEABQBlLTE2MAAFAGUtMTU5AAUAZS0xNTgABQBlLTE1NwAFAGUtMTU2AAUAZS0xNTUABQBlLTE1NAAFAGUtMTUzAAUAZS0xNTIABQBlLTE1MQAFAGUtMTUwAAUAZS0xNDkABQBlLTE0OAAFAGUtMTQ3AAUAZS0xNDYABQBlLTE0NQAFAGUtMTQ0AAUAZS0xNDMABQBlLTE0MgAFAGUtMTQxAAUAZS0xNDAABQBlLTEzOQAFAGUtMTM4AAUAZS0xMzcABQBlLTEzNgAFAGUtMTM1AAUAZS0xMzQABQBlLTEzMwAFAGUtMTMyAAUAZS0xMzEABQBlLTEzMAAFAGUtMTI5AAUAZS0xMjgABQBlLTEyNwAFAGUtMTI2AAUAZS0xMjUABQBlLTEyNAAFAGUtMTIzAAUAZS0xMjIABQBlLTEyMQAFAGUtMTIwAAUAZS0xMTkABQBlLTExOAAFAGUtMTE3AAUAZS0xMTYABQBlLTExNQAFAGUtMTE0AAUAZS0xMTMABQBlLTExMgAFAGUtMTExAAUAZS0xMTAABQBlLTEwOQAFAGUtMTA4AAUAZS0xMDcABQBlLTEwNgAFAGUtMTA1AAUAZS0xMDQABQBlLTEwMwAFAGUtMTAyAAUAZS0xMDEABQBlLTEwMAAFAGUtOTkAAAQAZS05OAAABABlLTk3AAAEAGUtOTYAAAQAZS05NQAABABlLTk0AAAEAGUtOTMAAAQAZS05MgAABABlLTkxAAAEAGUtOTAAAAQAZS04OQAABABlLTg4AAAEAGUtODcAAAQAZS04NgAABABlLTg1AAAEAGUtODQAAAQAZS04MwAABABlLTgyAAAEAGUtODEAAAQAZS04MAAABABlLTc5AAAEAGUtNzgAAAQAZS03NwAABABlLTc2AAAEAGUtNzUAAAQAZS03NAAABABlLTczAAAEAGUtNzIAAAQAZS03MQAABABlLTcwAAAEAGUtNjkAAAQAZS02OAAABABlLTY3AAAEAGUtNjYAAAQAZS02NQAABABlLTY0AAAEAGUtNjMAAAQAZS02MgAABABlLTYxAAAEAGUtNjAAAAQAZS01OQAABABlLTU4AAAEAGUtNTcAAAQAZS01NgAABABlLTU1AAAEAGUtNTQAAAQAZS01MwAABABlLTUyAAAEAGUtNTEAAAQAZS01MAAABABlLTQ5AAAEAGUtNDgAAAQAZS00NwAABABlLTQ2AAAEAGUtNDUAAAQAZS00NAAABABlLTQzAAAEAGUtNDIAAAQAZS00MQAABABlLTQwAAAEAGUtMzkAAAQAZS0zOAAABABlLTM3AAAEAGUtMzYAAAQAZS0zNQAABABlLTM0AAAEAGUtMzMAAAQAZS0zMgAABABlLTMxAAAEAGUtMzAAAAQAZS0yOQAABABlLTI4AAAEAGUtMjcAAAQAZS0yNgAABABlLTI1AAAEAGUtMjQAAAQAZS0yMwAABABlLTIyAAAEAGUtMjEAAAQAZS0yMAAABABlLTE5AAAEAGUtMTgAAAQAZS0xNwAABABlLTE2AAAEAGUtMTUAAAQAZS0xNAAABABlLTEzAAAEAGUtMTIAAAQAZS0xMQAABABlLTEwAAAEAGUtOQAAAAMAZS04AAAAAwBlLTcAAAADAGUtNgAAAAMAZS01AAAAAwBlLTQAAAADAGUtMwAAAAMAZS0yAAAAAwBlLTEAAAADAGUrMAAAAAMAZSsxAAAAAwBlKzIAAAADAGUrMwAAAAMAZSs0AAAAAwBlKzUAAAADAGUrNgAAAAMAZSs3AAAAAwBlKzgAAAADAGUrOQAAAAMAZSsxMAAABABlKzExAAAEAGUrMTIAAAQAZSsxMwAABABlKzE0AAAEAGUrMTUAAAQAZSsxNgAABABlKzE3AAAEAGUrMTgAAAQAZSsxOQAABABlKzIwAAAEAGUrMjEAAAQAZSsyMgAABABlKzIzAAAEAGUrMjQAAAQAZSsyNQAABABlKzI2AAAEAGUrMjcAAAQAZSsyOAAABABlKzI5AAAEAGUrMzAAAAQAZSszMQAABABlKzMyAAAEAGUrMzMAAAQAZSszNAAABABlKzM1AAAEAGUrMzYAAAQAZSszNwAABABlKzM4AAAEAGUrMzkAAAQAZSs0MAAABABlKzQxAAAEAGUrNDIAAAQAZSs0MwAABABlKzQ0AAAEAGUrNDUAAAQAZSs0NgAABABlKzQ3AAAEAGUrNDgAAAQAZSs0OQAABABlKzUwAAAEAGUrNTEAAAQAZSs1MgAABABlKzUzAAAEAGUrNTQAAAQAZSs1NQAABABlKzU2AAAEAGUrNTcAAAQAZSs1OAAABABlKzU5AAAEAGUrNjAAAAQAZSs2MQAABABlKzYyAAAEAGUrNjMAAAQAZSs2NAAABABlKzY1AAAEAGUrNjYAAAQAZSs2NwAABABlKzY4AAAEAGUrNjkAAAQAZSs3MAAABABlKzcxAAAEAGUrNzIAAAQAZSs3MwAABABlKzc0AAAEAGUrNzUAAAQAZSs3NgAABABlKzc3AAAEAGUrNzgAAAQAZSs3OQAABABlKzgwAAAEAGUrODEAAAQAZSs4MgAABABlKzgzAAAEAGUrODQAAAQAZSs4NQAABABlKzg2AAAEAGUrODcAAAQAZSs4OAAABABlKzg5AAAEAGUrOTAAAAQAZSs5MQAABABlKzkyAAAEAGUrOTMAAAQAZSs5NAAABABlKzk1AAAEAGUrOTYAAAQAZSs5NwAABABlKzk4AAAEAGUrOTkAAAQAZSsxMDAABQBlKzEwMQAFAGUrMTAyAAUAZSsxMDMABQBlKzEwNAAFAGUrMTA1AAUAZSsxMDYABQBlKzEwNwAFAGUrMTA4AAUAZSsxMDkABQBlKzExMAAFAGUrMTExAAUAZSsxMTIABQBlKzExMwAFAGUrMTE0AAUAZSsxMTUABQBlKzExNgAFAGUrMTE3AAUAZSsxMTgABQBlKzExOQAFAGUrMTIwAAUAZSsxMjEABQBlKzEyMgAFAGUrMTIzAAUAZSsxMjQABQBlKzEyNQAFAGUrMTI2AAUAZSsxMjcABQBlKzEyOAAFAGUrMTI5AAUAZSsxMzAABQBlKzEzMQAFAGUrMTMyAAUAZSsxMzMABQBlKzEzNAAFAGUrMTM1AAUAZSsxMzYABQBlKzEzNwAFAGUrMTM4AAUAZSsxMzkABQBlKzE0MAAFAGUrMTQxAAUAZSsxNDIABQBlKzE0MwAFAGUrMTQ0AAUAZSsxNDUABQBlKzE0NgAFAGUrMTQ3AAUAZSsxNDgABQBlKzE0OQAFAGUrMTUwAAUAZSsxNTEABQBlKzE1MgAFAGUrMTUzAAUAZSsxNTQABQBlKzE1NQAFAGUrMTU2AAUAZSsxNTcABQBlKzE1OAAFAGUrMTU5AAUAZSsxNjAABQBlKzE2MQAFAGUrMTYyAAUAZSsxNjMABQBlKzE2NAAFAGUrMTY1AAUAZSsxNjYABQBlKzE2NwAFAGUrMTY4AAUAZSsxNjkABQBlKzE3MAAFAGUrMTcxAAUAZSsxNzIABQBlKzE3MwAFAGUrMTc0AAUAZSsxNzUABQBlKzE3NgAFAGUrMTc3AAUAZSsxNzgABQBlKzE3OQAFAGUrMTgwAAUAZSsxODEABQBlKzE4MgAFAGUrMTgzAAUAZSsxODQABQBlKzE4NQAFAGUrMTg2AAUAZSsxODcABQBlKzE4OAAFAGUrMTg5AAUAZSsxOTAABQBlKzE5MQAFAGUrMTkyAAUAZSsxOTMABQBlKzE5NAAFAGUrMTk1AAUAZSsxOTYABQBlKzE5NwAFAGUrMTk4AAUAZSsxOTkABQBlKzIwMAAFAGUrMjAxAAUAZSsyMDIABQBlKzIwMwAFAGUrMjA0AAUAZSsyMDUABQBlKzIwNgAFAGUrMjA3AAUAZSsyMDgABQBlKzIwOQAFAGUrMjEwAAUAZSsyMTEABQBlKzIxMgAFAGUrMjEzAAUAZSsyMTQABQBlKzIxNQAFAGUrMjE2AAUAZSsyMTcABQBlKzIxOAAFAGUrMjE5AAUAZSsyMjAABQBlKzIyMQAFAGUrMjIyAAUAZSsyMjMABQBlKzIyNAAFAGUrMjI1AAUAZSsyMjYABQBlKzIyNwAFAGUrMjI4AAUAZSsyMjkABQBlKzIzMAAFAGUrMjMxAAUAZSsyMzIABQBlKzIzMwAFAGUrMjM0AAUAZSsyMzUABQBlKzIzNgAFAGUrMjM3AAUAZSsyMzgABQBlKzIzOQAFAGUrMjQwAAUAZSsyNDEABQBlKzI0MgAFAGUrMjQzAAUAZSsyNDQABQBlKzI0NQAFAGUrMjQ2AAUAZSsyNDcABQBlKzI0OAAFAGUrMjQ5AAUAZSsyNTAABQBlKzI1MQAFAGUrMjUyAAUAZSsyNTMABQBlKzI1NAAFAGUrMjU1AAUAZSsyNTYABQBlKzI1NwAFAGUrMjU4AAUAZSsyNTkABQBlKzI2MAAFAGUrMjYxAAUAZSsyNjIABQBlKzI2MwAFAGUrMjY0AAUAZSsyNjUABQBlKzI2NgAFAGUrMjY3AAUAZSsyNjgABQBlKzI2OQAFAGUrMjcwAAUAZSsyNzEABQBlKzI3MgAFAGUrMjczAAUAZSsyNzQABQBlKzI3NQAFAGUrMjc2AAUAZSsyNzcABQBlKzI3OAAFAGUrMjc5AAUAZSsy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YW5jaW5nIElvU2xpY2UgYmV5b25kIGl0cyBsZW5ndGhhZHZhbmNpbmcgaW8gc2xpY2VzIGJleW9uZCB0aGVpciBsZW5ndGhCb3g8ZHluIEFueT50aHJlYWQgY2F1c2VkIG5vbi11bndpbmRpbmcgcGFuaWMuIGFib3J0aW5nLgpmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyc3RhY2sgYmFja3RyYWNlOgpub3RlOiBTb21lIGRldGFpbHMgYXJlIG9taXR0ZWQsIHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT1mdWxsYCBmb3IgYSB2ZXJib3NlIGJhY2t0cmFjZS4KZmF0YWwgcnVudGltZSBlcnJvcjogdGhlIFN5c3RlbSBhbGxvY2F0b3IgbWF5IG5vdCB1c2UgVExTIHdpdGggZGVzdHJ1Y3RvcnMsIGFib3J0aW5nCmZhdGFsIHJ1bnRpbWUgZXJyb3I6IFVuZXhwZWN0ZWQgVExTIGZhaWx1cmUsIGFib3J0aW5nCmZhdGFsIHJ1bnRpbWUgZXJyb3I6IG91dCBvZiBUTFMga2V5cywgYWJvcnRpbmcKc3RyZXJyb3JfciBmYWlsdXJlZmFpbGVkIHRvIGdlbmVyYXRlIHVuaXF1ZSB0aHJlYWQgSUQ6IGJpdHNwYWNlIGV4aGF1c3RlZHJ3bG9jayBoYXMgbm90IGJlZW4gbG9ja2VkIGZvciByZWFkaW5nIgEICSsNKysrHCsrBgIDHisrGgwrGwQrKycjFCkrDxIoICsrIQorBSgrKwArKysmKysYJAcOECsrJCsrKysBCysrKysRGSsTFh0fSGFzaCB0YWJsZSBjYXBhY2l0eSBvdmVyZmxvdwEAAAAAAAAAU3VjY2VzcwBJbGxlZ2FsIGJ5dGUgc2VxdWVuY2UARG9tYWluIGVycm9yAFJlc3VsdCBub3QgcmVwcmVzZW50YWJsZQBOb3QgYSB0dHkAUGVybWlzc2lvbiBkZW5pZWQAT3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWQATm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQBObyBzdWNoIHByb2Nlc3MARmlsZSBleGlzdHMAVmFsdWUgdG9vIGxhcmdlIGZvciBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFF1b3RhIGV4Y2VlZGVkAE11bHRpaG9wIGF0dGVtcHRlZABDYXBhYmlsaXRpZXMgaW5zdWZmaWNpZW50AAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gVjYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90RXJyb3KqAQoBBAEFFwEfAQAEDA4FBwEBAVYBHRIBAgIEAQEGAQEDAQEBFAFTAYsIpgEmAQIGKQICIw4BAQECAQIBAwYbBAQdCwU4AQcOZgEIBAgEAwoDAgEQMA1lGCEJAgQBBRgCExMZBwsFGAEHBwEIKgoMAwcGTAEQAQMEDw0TAQgCAgIWAQcBAQMEAwgCAgICAQEIAQQCAQUMAgoBBAMBBgQCAhYBBwECAQIBAgQFBAICAgQBBwQBAREGCwMBCQEDARYBBwECAQUDCQEDAQIDAQ8EFQQEAwEIAgIC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FgEDARcBCgEFAgkBAwEEBwIFAwEEAgoBAwwNAQMBMwEDAQYEEAIaAQMBEgMYAQkBAQIHAwEEBgEBAQgGCgIDDDoEHSUCAQEBBQEYAQEBFwIFAQEBBwEKAgQgSAEkBCcBJAEPAQ0lxgEBBQECAAEEAgcBAQEEAikBBAIhAQQCBwEBAQQCDwE5AQQCQwIgAxoGVgIGAgADWQcWCRgJFAwNAQMBAgxeAgoGCgYaBlkHKwVGCh8BDAQMBAEDKgIFCywEGgYLAz4CQQEdAgsGCgYOAkEPTQGmCDwDDwM+BSsCCwgrBQACBgImAgYCCAEBAQEBAQEfAjUBDwEOAgYBEwIDAQkBZQEMAlELIQ+MBAAWCxUAAgAFLQEBBQECOAcCDhgJBwEHAQcBBwEHAQcBBwEHAX4CBBwaAVkM1hpQAVYCZwUrAV4BVgkwAQADNwkAFLgI3gQBDjwDCgY4CEYIDAZ0Cx4DTgELBCEBNwkOAgoCZxgcCgYCBgIGCQcBBwE+An4CCgYADBcEMQQAAmomBwwFBRoBBQEBAQIBAgEAICoGMwETAQQEBQGHAgEBvgMGAgYCBgIDAwcBBwoFAgwBGgETAQIBDwIOInsFAwQtA1gBDQMBLy6CHQMxDxwEJAkeBSsFHgElBA4qngIKBiQEJAQoCDQLDAEPAQcBAgELAQ8BBwECAzQMAAkWCggYBgEqAQ5ABgIBASwBAgMBAhcBSAgJMBMBAgUhAxsFGyY4BBQCMgECBQgBAwEdAgMECgcJB0AgJwQMCTYDHQIbBRoHBAwHUEk3Mw0zBy4ICgYmAx0IAtAfASoBAwICEAYBJgE4CCoWGiYcFBcJTgQkCUQKAQIZBwoGNQESCCcJYAEUCxIBLz4HAQEBBAEPAQsGOwUKBgQBCAICAhYBBwECAQUBCgICAgMCAQYBBQcCBwMFCwoBAQIBASYBCgEBAgEBBAEKAQIIAh1cAQUeSAgKpjYCJiJFCwoGDRM6BgoGFBwbAg8EF7k8ZFMMCAIBAggBAgEeAQICDAkKRggCLgILG0gIUw1JBwtVCFgiDgoGCQEtAQ4KHQMgAhYBDkkHAQIBLAMBAQIBCQgKBgYBAgElAQIBBgcKBiwECgYC7hkHEQEpAx1VAQ8yDQBmAAwAAGMNAAoABQAAOgAABx8BCgRRAQoGHgIGCkYKCgEHARUFEwA6xlsFGQIZLEsE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CAMABAUGBwMDBwADBgEDAggBAgUBBAUFAQkBBQICCAMGBggFAQgABgYEAAYCBQcCBwUJBQcGAQQBCAMEAgUJAAMDAgADAQIFAwYDBwkHCAgABwAJAQcBAgkFAQYGAAEFBgIFAQgBCAkICQQAAwUEBQgFBgQHBQgDAAAHCAECBQkACQQJBAcAAQcHAgkCCAIDBwkBBQADCQAGAgUEBQQHBAcDBQAICAYEBgQBAQgJBQcFAQkFAwECBQICBwMHAwYHBQQEAwIDAgAFCQQHCAcFCQcGBQYCBQEBAwYIBggDBwcCAQYBBgACCQcDCQMHCQgIAggBAgUFBggEAwQBCAgGAAgACAABBAgGCQYICQkEAQQABgIFAggEAgEHAAkEAwAEAAQAAAcEAwQIBAQJBwAHAAMBAgUBBAIBAAgFBAcBBQIAAgAAAwcBBwQCAgQIBQMFAQUGAgUHAQAFBAIHAwUHBgABAAABCAUIBwEBAgQCBgcFBwgBAgUDBQUCBwEDBgcICAAABQAACQIJAwUFBgIBAwMHCAkABgIFAQcHBgMFBggDCQQAAAIFAAQGBAYHBwgBAAYGCAkEBQMBAgUICAgBBwgEAQkHAAABAgUCAwIDAwgJAAUDAwQEBwIGBQYCBQQEBAAICQIACQgFAAAGAgYBBgEGCQQFAgYGBwIDBgMCCAECBQICAgAEBAYABAkCBQADAQMACAAIBAcCBgMDAwYBCAEGBAAGAgUBAQEAAgIDAAIEBgIFAQUGBQQABAIDBgMBBgYIAAkACAIAAwECBQUFBQEBAQUBAgMBAgUHCAIHAAIBAQgBBQgDBAAEBQQBAAEFBgIFAgcHBQUFBwUGAQUGAggJAQMFAQAFCQAHCQEHAAICBwAFAAcIAQIFAQMIBwcHCAcIAAcIAQQEBQYHBQUCCQUDCQUIBQEBAwUCBQMJAAYCBQYJAwgICQMJAAMJAAcCAggDBwcGBAcGCQcJAgUFBgcGAgYJBQMBAgUDBAYJBAQGCQUBCQUDBgEEAQgICAIDCAQICQYCBwgDCAEDBAcGBQYCBQEHAwQHAgMEBwUJBwYIAAcACQQEAQEJAgQECAEDCQEJAAYHAwgCCAECBQgGBwMGAQcDBwkICAQAAwUEBwIABQkGAgIEAAYJBQkFAwMGCQEEAAYCBQAAAAAAAFrWO5LWU/TuPzuhBimqPxH4ZWUbZrRY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");
		Promise.resolve(module0).catch(() => {});
		let module1 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgAX8AYAN/f38AYAJ/fwBgBH9/f38AAwsKAAECAwIAAAAAAAQFAXABCgoHNAsBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJCCRpbXBvcnRzAQAKcwoJACAAQQARAAALDQAgACABIAJBAREBAAsLACAAIAFBAhECAAsPACAAIAEgAiADQQMRAwALCwAgACABQQQRAgALCQAgAEEFEQAACwkAIABBBhEAAAsJACAAQQcRAAALCQAgAEEIEQAACwkAIABBCREAAAsALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1Ny4x");
		Promise.resolve(module1).catch(() => {});
		let module2 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABGgVgAX8AYAN/f38AYAJ/fwBgBH9/f38AYAAAApUBDAZhY3R1YWwBMAAABmFjdHVhbAExAAEGYWN0dWFsATIAAgZhY3R1YWwBMwADBmFjdHVhbAE0AAIGYWN0dWFsATUAAAZhY3R1YWwBNgAABmFjdHVhbAE3AAAGYWN0dWFsATgAAAZhY3R1YWwBOQAABG1haW4LX2luaXRpYWxpemUABARzaGltCCRpbXBvcnRzAXABCgoIAQoJEAEAQQALCgABAgMEBQYHCAkALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1Ny4x");
		Promise.resolve(module2).catch(() => {});
		let instanceFlags0 = new WebAssembly.Global({
			value: "i32",
			mutable: !0
		}, 1);
		INSTANCE_FLAGS.set(0, instanceFlags0);
		let _initTask0;
		let _initTaskID0;
		let _initThreadID0;
		try {
			{
				let { task, taskID, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
					componentIdx: 0,
					isAsync: !1,
					callingWasmExport: !0,
					entryFnName: "<initialize>"
				});
				_initTask0 = task;
				_initTaskID0 = taskID;
				_initThreadID0 = threadID;
				_setGlobalCurrentThreadMeta(CURRENT_TASK_META, {
					componentIdx: 0,
					taskID,
					threadID
				});
			}
			({exports: exports0} = yield instantiateCore(WebAssembly, yield module1));
			({exports: exports1} = yield instantiateCore(WebAssembly, yield module0, {
				"wasi:cli/environment@0.2.12": { "get-environment": Object.assign(exports0[5], { _jcoMaySuspend: !1 }) },
				"wasi:cli/exit@0.2.12": {
					exit: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline6, !1), { _jcoMaySuspend: !1 }),
					"exit-with-code": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline7, !1), { _jcoMaySuspend: !1 })
				},
				"wasi:cli/stderr@0.2.12": { "get-stderr": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline12, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/stdin@0.2.12": { "get-stdin": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline10, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/stdout@0.2.12": { "get-stdout": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline11, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-input@0.2.12": { "[resource-drop]terminal-input": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline4), !0), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-output@0.2.12": { "[resource-drop]terminal-output": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline5), !0), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stderr@0.2.12": { "get-terminal-stderr": Object.assign(exports0[8], { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stdin@0.2.12": { "get-terminal-stdin": Object.assign(exports0[6], { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stdout@0.2.12": { "get-terminal-stdout": Object.assign(exports0[7], { _jcoMaySuspend: !1 }) },
				"wasi:clocks/monotonic-clock@0.2.12": {
					now: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline13, !1), { _jcoMaySuspend: !1 }),
					"subscribe-duration": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline14, !1), { _jcoMaySuspend: !1 })
				},
				"wasi:clocks/wall-clock@0.2.12": { now: Object.assign(exports0[9], { _jcoMaySuspend: !1 }) },
				"wasi:io/error@0.2.12": { "[resource-drop]error": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline0), !0), { _jcoMaySuspend: !1 }) },
				"wasi:io/poll@0.2.12": {
					"[method]pollable.block": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline8, !1), { _jcoMaySuspend: !1 }),
					"[resource-drop]pollable": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline1), !0), { _jcoMaySuspend: !1 }),
					poll: Object.assign(exports0[1], { _jcoMaySuspend: !1 })
				},
				"wasi:io/streams@0.2.12": {
					"[method]output-stream.blocking-flush": Object.assign(exports0[4], { _jcoMaySuspend: !1 }),
					"[method]output-stream.check-write": Object.assign(exports0[2], { _jcoMaySuspend: !1 }),
					"[method]output-stream.subscribe": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline9, !1), { _jcoMaySuspend: !1 }),
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
			({exports: exports2} = yield instantiateCore(WebAssembly, yield module2, (_setGlobalCurrentThreadMeta(CURRENT_TASK_META, {
				componentIdx: 0,
				taskID: _initTaskID0,
				threadID: _initThreadID0
			}), {
				actual: {
					0: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline15, !1), { _jcoMaySuspend: !1 }),
					1: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline16, !1), { _jcoMaySuspend: !1 }),
					2: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline17, !1), { _jcoMaySuspend: !1 }),
					3: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline18, !1), { _jcoMaySuspend: !1 }),
					4: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline19, !1), { _jcoMaySuspend: !1 }),
					5: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline20, !1), { _jcoMaySuspend: !1 }),
					6: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline21, !1), { _jcoMaySuspend: !1 }),
					7: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline22, !1), { _jcoMaySuspend: !1 }),
					8: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline23, !1), { _jcoMaySuspend: !1 }),
					9: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline24, !1), { _jcoMaySuspend: !1 })
				},
				main: { _initialize: Object.assign(exports1._initialize, { _jcoMaySuspend: !1 }) },
				shim: { $imports: exports0.$imports }
			})));
			postReturn0 = exports1.cabi_post_parse;
			try {
				WebAssembly.promising(exports1.cabi_post_parse);
			} catch {
				exports1.cabi_post_parse;
			}
		} finally {
			_clearCurrentTask(CURRENT_TASK_META, {
				componentIdx: 0,
				taskID: _initTaskID0,
				threadID: _initThreadID0
			});
			if (_initTask0) {
				_initTask0.resolve([]);
				_initTask0.exit({ skipExclusiveLockCheck: !0 });
			}
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
