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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABpgEYYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gB39/f39/f38AYAZ/f39/f38AYAR/f39/AX9gBH9/f3wBf2AFf39/f38Bf2AEfn5/fwF+YAJ8fwF/YAh/f39/f39/fwBgA39+fgBgAX8BfmAFf35+fn4AAp0IFiB3YXNpOnJhbmRvbS9pbnNlY3VyZS1zZWVkQDAuMi4xMg1pbnNlY3VyZS1zZWVkAAYTd2FzaTppby9lcnJvckAwLjIuMBRbcmVzb3VyY2UtZHJvcF1lcnJvcgAGEndhc2k6aW8vcG9sbEAwLjIuMBdbcmVzb3VyY2UtZHJvcF1wb2xsYWJsZQAGFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbcmVzb3VyY2UtZHJvcF1pbnB1dC1zdHJlYW0ABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAcW3Jlc291cmNlLWRyb3Bdb3V0cHV0LXN0cmVhbQAGHXdhc2k6Y2xpL3Rlcm1pbmFsLWlucHV0QDAuMi4wHVtyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLWlucHV0AAYed2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4wHltyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLW91dHB1dAAGGndhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wD2dldC1lbnZpcm9ubWVudAAGE3dhc2k6Y2xpL2V4aXRAMC4yLjAEZXhpdAAGEndhc2k6aW8vcG9sbEAwLjIuMBZbbWV0aG9kXXBvbGxhYmxlLmJsb2NrAAYSd2FzaTppby9wb2xsQDAuMi4wBHBvbGwABxV3YXNpOmlvL3N0cmVhbXNAMC4yLjAhW21ldGhvZF1vdXRwdXQtc3RyZWFtLmNoZWNrLXdyaXRlAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQACFXdhc2k6aW8vc3RyZWFtc0AwLjIuMCRbbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gAARV3YXNpOmlvL3N0cmVhbXNAMC4yLjAfW21ldGhvZF1vdXRwdXQt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AkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiDGoiBiAITQ0AIAYgCGtBAUYNCgsCQCAFIAxLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQggASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEYOgAAIAEgA0EBajYCMCABLQCUASEDDAYLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEYOgAAC0EBIQMgAS0AgAFBAUcNAiABLQCVAUUNAiABQdgAakEYQQAgCiABKAJ8IAlLGxCigICAAAwCC0EBQQEQx4KAgAAAC0EBQQEQx4KAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgA0H/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQgCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgCDYCECADQQA2AgggAyAHNgIEIANBgTA7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEH80sKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBjNPCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEYQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQTBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEIEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAAL+xABEX8jgICAgABB0ABrIgIkgICAgABBASEDAkACQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCU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A0EANgIIIAMgBzYCBCADQYEgOwEAIAEgBkEBajYCGAwCCyAHIAMjgYCAgABB/NLCgABqEOSCgIAAAAsjgYCAgAAiAUG5nsCAAGpBKCABQYzTwoAAahDWgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBEEEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkEwaiSAgICAAAv0EwERfyOAgICAAEHgAGsiAiSAgICAAEEBIQMCQAJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQMCQAJAAkACQAJAAkACQCABQQEQooGAgABFDQAgASgCGCELIAIgASgCjAE2AiggAiABKQKEATcDICABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAAkAgAUEBEKKBgIAADQBBASEMDAELAkACQAJAAkACQAJAAkACQCABQQEQooGAgABFDQAgASgCGCEOIAIgAUGEAWoiDCgCCDYCOCACIAwpAgA3AzAgASgCPCENAkAgASgCVCIPIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgD0EBajYCVCABKAJQIA9BA3RqIg8gDTYCBCAPIA02AgACQCABQQEQooGAgABFDQAgASABLQCUASIQQQFHOgCUASACIAwoAgg2AkggAiAMKQIANwNAIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAACyABKAJQIA9BA3RqIhEgDTYCBCARIA02AgAgASAPQQFqNgJUQQAhDQJAIAEoAowBIg8gASgCiAFPDQAgDCgCACAPai0AAEHdAEcNACABIA9BAWo2AowBQQEhDQsCQCABLQCAAUEBRw0AEJiBgIAAQQFBARCV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AUcNBiABLQCVAUUNBwJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiDGoiBiAITQ0AIAYgCGtBAUYNCgsCQCAFIAxLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQggASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEROgAAIAEgA0EBajYCMCABLQCUASEDDAYLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEROgAAC0EBIQMgAS0AgAFBAUcNAiABLQCVAUUNAiABQdgAakERQQAgCiABKAJ8IAlLGxCigICAAAwCC0EBQQEQx4KAgAAAC0EBQQEQx4KAgAAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgA0H/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQgCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgCDYCECADQQA2AgggAyAHNgIEIANBgSI7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEH80sKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBjNPCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakERQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQTBqJICAgIAAC5QIAQp/I4CAgIAAQcAAayICJICAgIAAQQEhAwJAAkACQCABQQEQooGAgABFDQAgASgCGCEEIAIgASgCjAE2AgggAiABKQKEATcDACABKAI8IQMCQCABKAJUIgUgASgCTEcNACABQcwAahCmgICAAAsgAUE0aiEGIAFBhAFqIQcgASAFQQFqNgJUIAEoAlAgBUEDdGoiBSADNgIEIAUgAzYCAEEBIQMCQCABQQEQooGAgABFDQAgASgCGCEIIAIgBygCCDYCGCACIAcpAgA3AxAgASgCPCED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ATYCKCACIAEpAoQBNwMgIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABQYQBaiENIAEoAlAgC0EDdGoiDiADNgIEIA4gAzYCACABIAtBAWo2AlRBACELAkAgASgCjAEiA0F8Sw0AIANBA2oiDyABKAKIAUsNACANKAIAIANqIg4vAABBrdoAcyAOQQJqLQAAQS1zckH//wNxDQAgASAPNgKMAUEBIQsLAkAgAS0AgAFBAUcNABCYgYCAAEEDQQEQlYGAgAAiDkUNAiAOQS06AAIgDkGt2gA7AAAgAkEDNgI8IAIgDjYCOCACQoCAgIAwNwIwIAEgAyACQTBqIAsQoICAgAALAkACQAJAIAtFDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIA0oAgg2AkggAiANKQIANwNAIAEoAjwhAwJAIAEoAlQiCyABKAJMRw0AIAFBzABqEKaAgIAACyABIAtBAWo2AlQgASgCUCALQQN0aiILIAM2AgQgCyADNgIAAkAgAUEBEKKBgIAARQ0AIAJBGGogARCygICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCENIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgASALQQFqNgJUIAEoAlAgC0EDdGoiCyADNgIEIAsgAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAI4NgKMASABIAIpAzA3AoQBAkAgDSABKAIYSw0AIAEgDTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCENIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgASALQQFqNgJUIAEoAlAgC0EDdGoiCyADNgIEIAsgAzYCACACQQhqIAEQsoCAgAAgAigCDCEBAkAgAigCCCIDQQFHDQAgASACKAI4NgKMASABIAIpAzA3AoQBAkAgDSABKAIYSw0AIAEgDTYCGAsgAUE0ahCo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IgoNAAsgEEEBaiELAkAgAUEBcUUNACAPIAIgDCACIAtJIg0bLQAAOgAAIAwgAiALT2ohDCACIA1qIQILAkAgAiALRw0AIAwgFUEBakYNAQsQgIOAgAAACyAHQRBqJICAgIAADwsAC7YBAgJ/AX5BASEGQQQhBwJAAkAgBa0gA61+IghCIIinRQ0AQQAhAwwBCwJAIAinIgNBgICAgHggBGtNDQBBACEDDAELAkACQAJAAkAgAUUNACACIAUgAWwgBCADEJeBgIAAIQcMAQsCQCADDQAgBCEHDAILEJiBgIAAIAMgBBCVgYCAACEHCyAHDQAgACAENgIEDAELIAAgBzYCBEEAIQYLQQghBwsgACAHaiADNgIAIAAgBjYCAAuHWwEKfyOAgICAAEHAAGsiAiSAgICAAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAoAgAiA0GAgICAeHNBBSADQQBIGw4GAAECAwQFAAsgAiABNgIsIAJBBTYCKCACQQQ2AiAgAkEFNgIYIAJBCjYCECACI4GAgIAAIgNBkKPAgABqNgIkIAIgA0HroMCAAGo2AhwgAiADQYujwIAAajYCFCACIANBgaPAgABqNgIMIAJBOGogAkEMahDKgICAACACKAI4IQECQCACLQA8IgRB/wFHDQAgASEDDAwLIAIgBDoAPCAAKAIMIQUgACgCCCEGIAIgATYCOCABKAIAIQMCQCAEQQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEHroMCAAGpBBBDLgICAACIDDQsCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQy4CAgAAiAw0LIAAoAhghBSAAKAIUIQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB76DAgABqQQcQy4CAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNCyAALQA0IQUCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB9qDAgABqQQkQy4CAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAI4GAgIAAIQMgASgCACADQdzbwoAAaiAFQQJ0aigCAEECEMuAgIAAIgMNCyAAKAIkIQYgACgCICEHAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0H/oMCAAGpBBRDLgICAACIDDQsCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBaiIFNgIIIAEoAgQgA2pB2wA6AAAgBkUNBSAGQRxsIQggB0EYaiEEQQEhAwNAAkACQCADQQFxRQ0AIAUhAwwBCwJAIAEoAgAgBUcNACABIAVBAUEBQQEQmoCAgAAgASgCCCEFCyABIAVBAWoiAzYCCCABKAIEIAVqQSw6AAALAkAgASgCACADRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQfsAOgAAIARBcGooAgAhBSAEQWxqKAIAIQYgASOBgICAAEHCoMCAAGpBAhDLgICAACIDDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAIAEgBiAFEMuAgIAAIgMNDCAEQXxqKAIAIQUgBEF4aigCACEGAkAgASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBLDoAACABI4GAgIAAQcSgwIAAakEFEMuAgIAAIgMNDAJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQTo6AAAgASAGIAUQy4CAgAAiAw0MIAQtAAAhBQJAIAEoAgAgASgCCCIDRw0AIAEgA0EBQQFBARCagICAACABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQSw6AAAgASOBgICAAEHJoMCAAGpBBRDLgICAACIDDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWo2AgggASgCBCADakE6OgAAAkACQAJAAkACQCAFDgQAAQIDAAsgASOBgICAAEGqoMCAAGpBBBDLgICAACEDDAMLIAEjgYCAgABBrqDAgABqQQcQy4CAgAAhAwwCCyABI4GAgIAAQbWgwIAAakEHEMuAgIAAIQMMAQsgASOBgICAAEG8oMCAAGpBBhDLgICAACEDCyADDQwCQCABKAIAIAEoAggiA0cNACABIANBAUEBQQEQmoCAgAAgASgCCCEDCyABIANBAWoiBTYCCCABKAIEIANqQf0AOgAAIARBHGohBEEAIQMgCEFkaiIIDQALIAEoAgAgBUcNCgwJCyACIAE2AiwgAkEDNgIoIAJBBDYCICACQQM2AhggAkEKNgIQIAIjgYCAgAAiA0GYo8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBlaPAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMqAgIAAIAIoAjghAyACLQA8IgFB/wFGDQogAiABOgA0IAIgAzYCMCACQTBqI4GAgIAAQYmhwIAAakEFIABBEGoQzICAgAAiAw0KIAIoAjAiASgCACEDIAAoAgwhBSAAKAIIIQACQCACLQA0QQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEGKosCAAGpBBhDLgICAACIDDQoCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgMoAgAgAygCCCIGRw0AIAMgBkEBQQFBARCagICAACADKAIIIQYLIAMgBkEBaiIENgIIIAMoAgQgBmpB2wA6AAACQAJAIAUNAAJAIAMoAgAgBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAwBCwJAIAMoAgAgBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQQgACgCECEGIAAoAgwhCCADIARBxKDAgABqQQUQy4CAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgCCAGEMuAgIAAIgMNCyACQThqI4GAgIAAQZCiwIAAakEFIAArAwAQzYCAgAAiAw0LAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALAkAgBUEBRg0AIABBGGohACAFQRhsQWhqIQgDQAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAAAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB+wA6AAAgAiABNgI4IAJBAjoAPCAAQRBqKAIAIQUgAEEMaigCACEGIAMjgYCAgABBxKDAgABqQQUQy4CAgAAiAw0NAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNDSACQThqI4GAgIAAQZCiwIAAakEFIAArAwAQzYCAgAAiAw0NAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALIABBGGohACAIQWhqIggNAAsLAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakHdADoAAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhAwwKCyACIAE2AiwgAkEFNgIoIAJBBDYCICACQQU2AhggAkEKNgIQIAIjgYCAgAAiA0Ggo8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBm6PAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMqAgIAAIAIoAjghAyACLQA8IgFB/wFGDQkgAiABOgA0IAIgAzYCMCACQTBqI4GAgIAAQYmhwIAAakEFIABBEGoQzICAgAAiAw0JIAIoAjAiASgCACEDIAAoAgwhBSAAKAIIIQQCQCACLQA0QQFGDQACQCADKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAIAEoAgAhAwsgAkECOgA0IAMjgYCAgABBlaLAgABqQQgQy4CAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWoiBjYCCCADKAIEIABqQdsAOgAAAkACQCAFDQACQCADKAIAIAZHDQAgAyAGQQFBAUEBEJqAgIAAIAMoAgghBgsgAyAGQQFqNgIIIAMoAgQgBmpB3QA6AAAMAQsgBCAFQRhsaiEJQQEhAANAIAEoAgAhAwJAIABBAXENAAJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAAgASgCACEDCwJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQfsAOgAAI4GAgIAAIQMgBCgCCCEFIAQoAgQhBiABKAIAIANBnaLAgABqQQQQy4CAgAAiAw0LAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNCyAEKAIUIQYgBCgCECEFAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakEsOgAAI4GAgIAAIQMgASgCACADQaGiwIAAakEFEMuAgIAAIgMNCwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBOjoAAAJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqIgg2AgggAygCBCAAakHbADoAAAJAAkAgBg0AAkAgAygCACAIRw0AIAMgCEEBQQFBARCagICAACADKAIIIQgLIAMgCEEBajYCCCADKAIEIAhqQd0AOgAADAELAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQAgBSgCCCEIIAUoAgQhByADIABBnaLAgABqQQQQy4CAgAAiAw0MAkAgASgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakE6OgAAIAEoAgAgByAIEMuAgIAAIgMNDCACQThqI4GAgIAAQcKgwIAAakECIAVBGGoQzICAgAAiAw0MIAJBOGojgYCAgABBpqLAgABqQQQgBSgCECAFKAIUEM6AgIAAIgMNDCACQThqI4GAgIAAQaqiwIAAakEIIAVBJGoQzICAgAAiAw0MAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AAALAkAgBkEBRg0AIAZBMGxBUGohCkEAIQgDQAJAIAEoAgAiAygCACADKAIIIgBH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ACAAKAIIIQMLIAAgA0EBajYCCCAAKAIEIANqQSw6AAAgACOBgICAAEHdocCAAGpBBBDLgICAACIDDQkCQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakE6OgAAIAAgByAIEMuAgIAAIgMNCSABQSRqLQAAIQECQCAAKAIAIAAoAggiA0cNACAAIANBAUEBQQEQmoCAgAAgACgCCCEDCyAAIANBAWo2AgggACgCBCADakEsOgAAIAAjgYCAgABB4aHAgABqQQkQy4CAgAAiAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJqAgIAAIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA2pBOjoAAAJAAkACQAJAAkAgAQ4EAAECAwALIAAjgYCAgABB6qHAgABqQQUQy4CAgAAhAwwDCyAAI4GAgIAAQe+hwIAAakEGEMuAgIAAIQMMAgsgACOBgICAAEH1ocCAAGpBChDLgICAACEDDAELIAAjgYCAgABB/6HAgABqQQsQy4CAgAAhAwsgAw0JAkAgACgCACAAKAIIIgNHDQAgACADQQFBAUEBEJqAgIAAIAAoAgghAwsgACADQQFqIgE2AgggACgCBCADakH9ADoAAEEAIQMgCyAEQShqIgRHDQALIAAoAgAgAUcNBQwECyACIAE2AiwgAkEFNgIoIAJBBDYCICACQQU2AhggAkEKNgIQIAIjgYCAgAAiA0G6o8CAAGo2AiQgAiADQeugwIAAajYCHCACIANBtaPAgABqNgIUIAIgA0GBo8CAAGo2AgwgAkE4aiACQQxqEMqAgIAAIAIoAjghAQJAIAItADwiBEH/AUcNACABIQMMCAsgASgCACEDIAAoAgwhBiAAKAIIIQUCQCAEQQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEHrosCAAGpBBxDLgICAACIDDQcCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAACQCABKAIAIgMoAgAgAygCCCIIRw0AIAMgCEEBQQFBARCagICAACADKAIIIQgLIAMgCEEBaiIENgIIIAMoAgQgCGpB2wA6AAACQAJAIAYNAAJAIAMoAgAgBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAwBCwJAIAMoAgAgBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakH7ADoAACACIAE2AjggAkECOgA8I4GAgIAAIQQgBSgCCCEIIAUoAgQhByADIARBnaLAgABqQQQQy4CAgAAiAw0IAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMuAgIAAIgMNCCACQThqI4GAgIAAQcyiwIAAakEKIAUoAhAgBSgCFBDPgICAACIDDQggAkE4aiOBgICAAEHWosCAAGpBByAFKAIcIAUoAiAQz4CAgAAiAw0IAkAgAi0APEUNAAJAIAIoAjgoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB/QA6AAALAkAgBkEBRg0AIAZBJGxBXGohCkEAIQYDQAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBLDoAAAJAIAEoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpB+wA6AAAgAiABNgI4IAJBAjoAPCAFIAZqIgRBLGooAgAhByAEQShqKAIAIQsgAyOBgICAAEGdosCAAGpBBBDLgICAACIDDQoCQCABKAIAIgMoAgAgAygCCCIIRw0AIAMgCEEBQQFBARCagICAACADKAIIIQgLIAMgCEEBajYCCCADKAIEIAhqQTo6AAAgASgCACALIAcQy4CAgAAiAw0KIAJBOGojgYCAgABBzKLAgABqQQogBEE0aigCACAEQThqKAIAEM+AgIAAIgMNCiACQThqI4GAgIAAQdaiwIAAakEHIARBwABqKAIAIARBxABqKAIAEM+AgIAAIgMNCgJAIAItADxFDQACQCACKAI4KAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQf0AOgAACyAKIAZBJGoiBkcNAAsLAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakHdADoAAAsgACgCGCEEIAAoAhQhBgJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpBLDoAACOBgICAACEDIAEoAgAgA0HyosCAAGpBDRDLgICAACIDDQcCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQTo6AAACQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBaiIFNgIIIAMoAgQgAGpB2wA6AAACQAJAIAQNAAJAIAMoAgAgBUcNACADIAVBAUEBQQEQmoCAgAAgAygCCCEFCyADIAVBAWo2AgggAygCBCAFakHdADoAAAwBCyAEQTxsIQtBACEFQQEhAANAIAEoAgAhAwJAIABBAXENAAJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQSw6AAAgASgCACEDCwJAIAMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQfsAOgAAIAIgATYCOCAGIAVqIgBBCGooAgAhCCAAQQRqKAIAIQcgAyOBgICAAEHXocCAAGpBBBDLgICAACIDDQkCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAHIAgQy4CAgAAiAw0JIABBFGooAgAhCCAAQRBqKAIAIQcCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANB26HAgABqQQIQy4CAgAAiAw0JAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgByAIEMuAgIAAIgMNCSAAQSBqKAIAIQggAEEcaigCACEHAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0HdosCAAGpBBxDLgICAACIDDQkCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAHIAgQy4CAgAAiAw0JIAJBOGojgYCAgABBxKDAgABqQQUgAEEwahDMgICAACIDDQkgAEEsaigCACEIIABBKGooAgAhByACKAI4IgAoAgAhAwJAIAItADxBAUYNAAJAIAMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAgACgCACEDCyADI4GAgIAAQeSiwIAAakEHEMuAgIAAIgMNCQJAIAAoAgAiAygCACADKAIIIgRHDQAgAyAEQQFBAUEBEJqAgIAAIAMoAgghBAsgAyAEQQFqNgIIIAMoAgQgBGpBOjoAACAAKAIAIAcgCBDLgICAACIDDQkCQCAAKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQf0AOgAAQQAhACALIAVBPGoiBUcNAAsCQCABKAIAIgMoAgAgAygCCCIARw0AIAMgAEEBQQFBARCagICAACADKAIIIQALIAMgAEEBajYCCCADKAIEIABqQd0AOgAACwJAIAEoAgAiAygCACADKAIIIgBHDQAgAyAAQQFBAUEBEJqAgIAAIAMoAgghAAsgAyAAQQFqNgIIIAMoAgQgAGpB/QA6AABBACEDDAcLIAIgATYCLCACQQg2AiggAkEENgIgIAJBCDYCGCACQQo2AhAgAiOBgICAACIDQcejwIAAajYCJCACIANB66DAgABqNgIcIAIgA0G/o8CAAGo2AhQgAiADQYGjwIAAajYCDCACQThqIAJBDGoQyoCAgAAgAigCOCEDIAItADwiAUH/AUYNBiACIAE6ADwgAiADNgI4IAJBOGojgYCAgABBiaHAgABqQQUgAEHIAGoQzICAgAAiAw0GIAIoAjgiASgCACEDIAAoAgghBSAAKAIEIQYCQCACLQA8QQFGDQACQCADKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAEoAgAhAwsgAyOBgICAAEGOocCAAGpBCRDLgICAACIDDQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQy4CAgAAiAw0GIAAoAhQhBSAAKAIQIQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQSw6AAAjgYCAgAAhAyABKAIAIANBl6HAgABqQQoQy4CAgAAiAw0GAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakE6OgAAIAEoAgAgBiAFEMuAgIAAIgMNBiAAKAIgIQUgACgCHCEGAkAgASgCACIDKAIAIAMoAggiBEcNACADIARBAUEBQQEQmoCAgAAgAygCCCEECyADIARBAWo2AgggAygCBCAEakEsOgAAIAJBAjoAPCOBgICAACEDIAEoAgAgA0GhocCAAGpBCxDLgICAACIDDQYCQCABKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQTo6AAAgASgCACAGIAUQy4CAgAAiAw0GIAJBOGojgYCAgABBrKHAgABqQQggACgCKCAAKAIsENCAgIAAIgMNBiACQThqIAAoAjQgACgCOBDRgICAACIDDQYgAkE4aiAAKAJAIAAoAkQQ0oCAgAAiAw0GIAIoAjgoAgAgAi0APBDTgICAACEDDAYLIAEoAgAgBUYNAwwECyAAKAIAIAFHDQELIAAgAUEBQQFBARCagICAACAAKAIIIQELIAAoAgQgAWpB3QA6AAAgACABQQFqNgIIAkAgBSgCACIDKAIAIAMoAggiAEcNACADIABBAUEBQQEQmoCAgAAgAygCCCEACyADIABBAWo2AgggAygCBCAAakH9ADoAAEEAIQMMAgsgASAFQQFBAUEBEJqAgIAAIAEoAgghBQsgASgCBCAFakHdADoAACABIAVBAWo2AgggAkE4aiAAKAIsIAAoAjAQ1ICAgAAiAw0AIAIoAjgoAgAgAi0APBDTgICAACEDCyACQcAAaiSAgICAACADC/IBAQR/AkAgASgCICICKAIAIgMoAgAgAygCCCIERw0AIAMgBEEBQQFBARCagICAACADKAIIIQQLIAMgBEEBajYCCCADKAIEIARqQfsAOgAAIAEoAhwhBCABKAIYIQVB/wEhAwJAIAIoAgAgASgCECABKAIUEMuAgIAAIgENAAJAIAIoAgAiASgCACABKAIIIgNHDQAgASADQQFBAUEBEJqAgIAAIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBOjoAAEF/QQIgAigCACAFIAQQy4CAgAAiARshAyABIAIgARshAQsgACADOgAEIAAgATYCAAvpBAEGfwJAIAAoAgAgACgCCCIDRw0AIAAgA0EBQQFBARCagICAACAAKAIIIQMLIAAgA0EBaiIENgIIIAAoAgQgA2pBIjoAAAJAIAJFDQADQCACIQVBACEDAkADQCABIANqIgYtAAAiByOFgICAAGotAAAiAg0BIAUgA0EBaiIDRw0ACyAFIQIMAgsCQCADRQ0AAkAgAyAAKAIAIARrTQ0AIAAgBCADQQFBARCagICAACAAKAIIIQQLAkAgA0UNACAAKAIEIARqIAEgA/wKAAALIAAgBCADaiIENgIICwJAAkAgAkH1AEcNACAAKAIAIQEjhoCAgAAiAiAHQQ9xai0AACEIIAIgB0EEdmotAAAhAgJAIAEgBGtBBUsNACAAIARBBkEBQQEQmoCAgAAgACgCCCEECyAAKAIEIARqIgEgCDoABSABIAI6AAQgAUHc6sGBAzYAACAEQQZqIQQMAQsCQCAAKAIAIARrQQFLDQAgACAEQQJBAUEBEJqAgIAAIAAoAgghBAsgACgCBCAEaiIBIAI6AAEgAUHcADoA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IAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkACQCABQQEQooGAgABFDQAgAkEYaiABEK+AgIAAIAIoAhwhAQJAIAIoAhhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBEGogARCvgICAACACKAIUIQECQCACKAIQIgVBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgBUEBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBCGogARCvgICAACACKAIMIQECQCACKAIIIgVBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAVBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAIIAEoAhhLDQAgASAINgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAAgAiABENiAgIAAIAIoAgQhASACKAIAIQMLAkAgA0EBRw0AIAEgAigCODYCjAEgASACKQMwNwKEAQJAIAcgASgCGEsNACABIAc2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFHDQAgASACKAIoNgKMASABIAIpAyA3AoQBAkAgBCABKAIYSw0AIAEgBDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAAIAM2AgAgACABNgIEIAJB4ABqJICAgIAAC5QVAQ5/I4CAgIAAQfAAayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQMCQAJAAkACQAJAAkACQCABQQEQooGAgABFDQAgASgCGCELIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAIAFBARCigYCAAEUNACABKAIYIQ4gAiABQYQBaiIMKAIINgJYIAIgDCkCADcDUCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBOGogARCygICAACACKAI8IQECQCACKAI4QQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQwMAQsgASgCGCEPIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCACACQTBqIAEQsoCAgAAgAigCNCEBAkAgAigCMCIMQQFHDQAgASACKAJoNgKMASABIAIpA2A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAxBAXENAANAAkACQCABQQEQooGAgAANAEEBIQwMAQsgASgCGCEPIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCACACQShqIAEQsoCAgAAgAigCLCEBAkAgAigCKCIMQQFHDQAgASACKAJoNgKMASABIAIpA2A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAMQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBIGogARCGgYCAACACKAIkIQEgAigCIEEBcQ0AIAFBARCigYCAAEUNACABKAIYIQ4gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkAgAUEBEKKBgIAARQ0AIAJBGGogARCygICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQwMAQsgASgCGCEPIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIMQQFHDQAgASACKAJoNgKMASABIAIpA2A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAxBAXENAANAAkACQCABQQEQooGAgAANAEEBIQwMAQsgASgCGCEPIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQwCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCACACQQhqIAEQsoCAgAAgAigCDCEBAkAgAigCCCIMQQFHDQAgASACKAJoNgKMASABIAIpA2A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyAMQQFHDQALCyABLQAMQQJGDQQLIAEtAAxBAkYNAwsgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAsgASACKAJINgKMASABIAIpA0A3AoQBAkAgCyABKAIYSw0AIAEgCzYCGAsgAUE0ahCogICAAAsgAS0AlAFBAUYNBiABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgwgASgCJCIDaiIGIAhNDQAgBiAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAxLDQIgASAENgIwDAILIAFBNGoiAxCpgICAACADEKmAgIAAIAEtAJQBIgNBAUcNAyABLQCVAUUNBAJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiDGoiBiAITQ0AIAYgCGtBAUYNBwsCQCAFIAxLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQUgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEGOgAAIAEgA0EBajYCMCABLQCUASEDDAMLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEGOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQQZBACAKIAEoAnwgCUsbEKKAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgA0H/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiIGLQAADQEgBiADNgIEIAEoAowBIQgCQCABKAIYIgYgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAZBFGxqIgMgCDYCECADQQA2AgggAyAHNgIEIANBgQw7AQAgASAGQQFqNgIYDAILIAcgAyOBgICAAEH80sKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBjNPCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEGQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQfAAaiSAgICAAAu7DwEIfyOAgICAAEGAAWsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQAgASgCGCEEIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQUCQCABKAJUIgYgASgCTEcNACABQcwAahCmgICAAAtBASEDIAEgBkEBajYCVCABKAJQIAZBA3RqIgYgBTYCBCAGIAU2AgACQCABQQEQooGAgABFDQAgASgCGCEHIAIgAUGEAWoiBSgCCDYCWCACIAUpAgA3A1AgASgCPCEGAkAgASgCVCIIIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhAyABIAhBAWo2AlQgASgCUCAIQQN0aiIIIAY2AgQgCCAGNgIAAkAgAUEBEKKBgIAARQ0AIAEoAhghCCACIAUoAgg2AmggAiAFKQIANwNgIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAAkACQCABQQEQooGAgABFDQAgAkE4aiABELKAgIAAIAIoAjwhAQJAIAIoAjhBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBMGogARCygICAACACKAI0IQECQCACKAIwIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgBUEBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhBQwBCyABKAIYIQkgAiABKAKMATYCeCACIAEpAoQBNwNwIAEoAjwhBQJAIAEoAlQiBiABKAJMRw0AIAFBzABqEKaAgIAACyABIAZBAWo2AlQgASgCUCAGQQN0aiIGIAU2AgQgBiAFNgIAIAJBKGogARCygICAACACKAIsIQECQCACKAIoIgVBAUcNACABIAIoAng2AowBIAEgAikDcDcChAECQCAJIAEoAhhLDQAgASAJNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAVBAUcNAAsLIAEtAAxBAkYN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QQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiBBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBGGogARCygICAACACKAIcIQECQCACKAIYIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCWCACIAEpAoQBNwNQIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBEGogARCygICAACACKAIUIQECQCACKAIQIgNBAUcNACABIAIoAlg2AowBIAEgAikDUDcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAkg2AowBIAEgAikDQDcChAECQCAOIAEoAhhLDQAgASAONgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgABBASELIAFBARCigYCAAEUNACACQQhqIAEQjYGAgAAgAigCDCEBAkAgAigCCCILQQFHDQAgAS0ADEECRw0BC0EAIQsLAkAgC0EBRw0AIAEgAigCODYCjAEgASACKQMwNwKEAQJAIAwgASgCGEsNACABIAw2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDIAEtAJQBIQ0CQAJAAkACQAJAAkAgC0EBRw0AIA1B/wFxQQFGDQYgAS0AlQFFDQMgASgCkAEiAyAGRw0BAkAgASgCMCIGIAEoAiQiA2oiCyAITQ0AIAsgCGtBAUYNBAsCQCAFIANLDQAgASAFNgIk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IQMMBAsgAkEIaiABENyAgIAAIAIoAgwhASACKAIIQQFxRQ0BDAILQQFBARDHgoCAAAALA0AgAiABENyAgIAAIAIoAgQhASACKAIAQQFxRQ0ACwsgAS0ADEECRyEDCwJAIANBAUcNACABIAIoAig2AowBIAEgAikDIDcChAECQCAEIAEoAhhLDQAgASAENgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAAgATYCBCAAIAM2AgAgAkHAAGokgICAgAAL9AEBAn8jgICAgABBEGsiBCSAgICAAAJAAkAgA0EBaiIDRQ0AAkAgAiADSw0AIAIgA0YNAQwCCyABIANqLAAAQUBIDQELIARBCGogASADaiACIANrEJeAgIAAQQAhAgJAIAQoAgwiA0EASA0AAkACQCADDQBBASEBDAELIAQoAgghBRCYgYCAAEEBIQIgA0EBEJWBgIAAIgFFDQEgA0UNACABIAUgA/wKAAALIAAgAzYCCCAAIAE2AgQgACADNgIAIARBEGokgICAgAAPCyACIAMQx4KAgAAACyABIAIgAyACI4GAgIAAQbDUwoAAahDwgoCAAAALowIBA38jgICAgABBEGsiAiSAgICAABCYgYCAAAJAAkACQEGAAUEBEJWBgIAAIgNFDQAgAkEANgIIIAIgAzYCBCACQYABNgIAIAIgAjYCDAJAIAEgAkEMahDJgICAACIDRQ0AIAIoAgAiBEUNAiACKAIEIARBARCWgYCAAAwCCyACKAIEIQMgAigCACIEQX9GDQEgACACKAIINgIIIAAgAzYCBCAAIAQ2AgAMAgtBAUGAARDHgoCAAAALIABBfzYCAAJAAkACQCADKAIADgIAAQILIAMoAggiAEUNASADKAIEIABBARCWgYCAAAwBCyADLQAEQQNHDQAgA0EIahCGg4CAAAsgA0EUQQQQloGAgAALIAEQwYCAgAAgAkEQaiSAgICAAAuBAwECfyOAgICAAEHwAGsiAiSAgICAACACQYCAgIB4NgIMIAIgASgCMDYCQCACIAEpAig3AjggAiABKQIgNwIwIAIgASkCGDcCKCACIAEpAhA3AiAgAiABKQIINwIYIAIgASkCADcCEBCYgYCAAAJAAkACQEGAAUEBEJWBgIAAIgFFDQAgAkEANgJoIAIgATYCZCACQYABNgJgIAIgAkHgAGo2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IAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEEQRAQyICAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEMeCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAt/AQN/I4CAgIAAQRBrIgEkgICAgAAgAUEEaiAAKAIAIgIgACgCBCACQQF0IgJBBCACQQRLGyICQQRBKBDIgICAAAJAIAEoAgRBAUcNACABKAIIIAEoAgwQx4KAgAAACyABKAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEEYEMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEIQSAQyICAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEMeCgIAAAAsgASgCCCEDIAAgAjYCACAAIAM2AgQgAUEQaiSAgICAAAt/AQN/I4CAgIAAQRBrIgEkgICAgAAgAUEEaiAAKAIAIgIgACgCBCACQQF0IgJBBCACQQRLGyICQQRBJBDIgICAAAJAIAEoAgRBAUcNACABKAIIIAEoAgwQx4KAgAAACyABKAIIIQMgACACNgIAIAAgAzYCBCABQRBqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEE8EMiAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBDHgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALfwEDfyOAgICAAEEQayIBJICAgIAAIAFBBGogACgCACICIAAoAgQgAkEBdCICQQQgAkEESxsiAkEIQRgQyICAgAACQCABKAIEQQFHDQAgASgCCCABKAIMEMeCgIAAAAsgASgC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AUcNAyACLQAAQf0ARw0DIAtBf2oiCw0DIANBkANqIANBuAFqEM6CgIAAIAUgAygCyAEgAygCzAEQ/oCAgAAgBCADKALUASADKALYARD+gICAAAJAIAMoAqgBIgEgAygCoAFHDQAgA0GgAWoQ6oCAgAALIAMoAqQBIAFBJGxqIgIgAygCsAM2AiAgAiADKQKoAzcCGCACIAMpAqADNwIQIAIgAykCmAM3AgggAiADKQKQAzcCACADIAFBAWo2AqgBIAMoArgBIgJBf0YNAgJAIAJFDQAgAygCvAEgAkEBEJaBgIAACyAIELuAgIAAIAcQu4CAgAAMAgsgAi0AAEH7AEYNACACLQABQfsARg0AIAItAAJB+wBGDQAgAi0AA0H7AEYNACACLQAEQfsARg0AIAItAAVB+wBGDQAgAUEGRg0EIAItAAZB+wBHDQQLAkACQCACKAAAQePYhZsHcyACQQRqLwAAQfPAAHNyRQ0AIABBfzYCAAwBCyADQYABaiACQQZqIAFBemoQl4CAgAAgAygCgAEhDiADKAKEASENIANBATsBtAMgAyANNgKwAyADQQA2AqwDIANBAToAqAMgA0H7ADYCpAMgAyANNgKgAyADQQA2ApwDIAMgDTYCmAMgAyAONgKUAyADQfsANgKQAyADQfgAaiADQZADahD1gICAAAJAAkACQAJAAkAgAygCeCINRQ0AIANB8ABqIA0gAygCfBCXgICAAEEAIQ4CQCADKAJ0Ig1BAEgNACANRQ0DIAMoAnAhDxCYgYCAAEEBIQ4gDUEBEJWBgIAAIhANAiANIRALIA4gEBDHgoCAAAALIABBfzYCAAwECwJAIA1FDQAgECAPIA38CgAACyADQgQ3AvACIANCADcC6AIgA0KAgICAwAA3AuACIAMgDTYC3AIgAyAQNgLYAiADIA02AtQCIANBATsBtAMgAyABNgKwAyADQQA2AqwDIANBAToAqAMgA0H7ADYCpAMgAyABNgKgAyADQQA2ApwDIAMgATYCmAMgAyACNgKUAyADQfsANgKQAyADQegAaiADQZADahD1gICAACADKAJoRQ0CIANB4ABqIANBkANqEPWAgIAAIAMoAmAiAUUNAgJAAkAgAygCZCICQQdLDQAgAkUNBCABLQAAQf0ARg0BIAJBAUYNBCABLQABQf0ARg0BIAJBAkYNBCABLQACQf0ARg0BIAJBA0YNBCABLQADQf0ARg0BIAJBBEYNBCABLQAEQf0ARg0BIAJBBUYNBCABLQAFQf0ARg0BIAJBBkYNBCABLQAGQf0ARg0BDAQLIANB2ABqQf0AIAEgAhD5goCAACADKAJYQQFxRQ0DCyADQQE7AbQDIAMgAjYCsAMgA0EANgKsAyADQQE6AKgDIANB/QA2AqQDIAMgAjYCoAMgA0EANgKcAyADIAI2ApgDIAMgATYClAMgA0H9ADYCkAMgA0HQAGogA0GQA2oQ9YCAgAAgAygCVCEBIAMoAlAhAiADQQE7AbQDIAMgAUEAIAIbIgE2ArADIANBADYCrAMgA0EBOgCoAyADQTs2AqQDIAMgATYCoAMgA0EANgKcAyADIAE2ApgDIAMgAkEBIAIbNgKUAyADQTs2ApADIANByABqIANBkANqEPWAgIAAIAMoAkgiAkUNASADKAJMIQEDQCADQcAAaiACIAEQl4CAgAAgA0GsAmogAygCQCADKAJEEPuAgIAAAkAgAygCrAJBf0YNAAJAIAMtANACQQFxDQACQCADKALoAiIBIAMoAuACRw0AIANB1AJqQQxqEOeAgIAACyADKALkAiABQShsaiICIAMpAqwCNwIAIAIgAykCtAI3AgggAiADKQK8AjcCECACIAMpAsQCNwIYIAIgAygCzAI2AiAgAkEAOgAkIAIgCS8AADsAJSACIAktAAI6ACcgAyABQQFqNgLoAgwBCwJAIAMoAvQCIgEgAygC7AJHDQAgA0HUAmpBGGoQ54CAgAALIAMoAvACIAFBKGxqIgIgAykCrAI3AgAgAiADKQK0AjcCCCACIAMpArwCNwIQIAIgAykCxAI3AhggAiADKALMAjYCICACQQE6ACQgAiAJLwAAOwAlIAIgCS0AAjoAJyADIAFBAWo2AvQCCyADQThqIANBkANqEPWAgIAAIAMoAjwhASADKAI4IgJFDQIMAAsLQQEhEAwFCwJAIAMoAqgBIgEgAygCoAFHDQAgA0GgAWoQ6oCAgAALIAMoAqQBIAFBJGxqIgIgAykC1AI3AgAgAiADKQLcAjcCCCACIAMpAuQCNwIQIAIgAykC7AI3AhggAiADKAL0AjYCICADIAFBAWo2AqgBDAQLAkAgDEF/Rg0AAkAgDEUNACADKAK8ASAMQQEQloGAgAALIAgQu4CAgAAgBxC7gICAAAsgAyADKAL0AjYC2AEgAyADKQLsAjcD0AEgAyADKQLkAjcDyAEgAyADKQLcAjcDwAEgAyADKQLUAjcDuAFBASELQQEhCgwDCyAMQX9GDQYCQCAMRQ0AIAMoArwBIAxBARCWgYCAAAsgCBC7gICAACAHELuAgIAADAYLIANBfzYCuAFBACELQQAhCgwBC0EBIQogC0EATA0AAkAgAUUNACACLQAAQSVGDQELIANBhAJqIAIgARD7gICAACADKAKEAkF/Rg0AAkAgAy0AqAJBAXENAAJAIAMoAswBIgEgAygCxAFHDQAgCBDngICAAAsgAygCyAEgAUEobGoiAiADKAKkAjYCICACIAMpApwCNwIYIAIgAykClAI3AhAgAiADKQKMAjcCCCACIAMpAoQCNwIAIAJBADoAJCACIAYvAAA7ACUgAiAGLQACOgAnQQEhCiADIAFBAWo2AswBDAELAkAgAygC2AEiASADKALQAUcNACAHEOeAgIAACyADKALUASABQShsaiICIAMoAqQCNgIgIAIgAykCnAI3AhggAiADKQKUAjcCECACIAMpAowCNwIIIAIgAykChAI3AgBBASEKIAJBAToAJCACIAYvAAA7ACUgAiAGLQACOgAnIAMgAUEBajYC2AELIAMgA0HcAWoQ9ICAgAAgAygCBCECIAMoAgAiAQ0BDAILAkACQCACLQAAQSVGDQBBBCENIANBkANqIAIgASOBgICAACIMQaymwIAAakEEEO6CgIAAIANBhANqIANBkANqEP+AgIAAAkACQCADKAKEA0EBRw0AIAxBwNfCgABqIREMAQtBAyENIANBkANqIAIgASOBgICAACIMQbumwIAAakEDEO6CgIAAIANBhANqIANBkANqEP+AgIAAAkAgAygChANFDQAgDEHA18KAAGpBGGohEQwBC0EDIQ0gA0GQA2ogAiABI4GAgIAAIgxByabAgABqQQMQ7oKAgAAgA0GEA2ogA0GQA2oQ/4CAgAACQCADKAKEA0UNACAMQcDXwoAAakEwaiERDAELQQQhDSADQZADaiACIAEjgYCAgAAiDEHXpsCAAGpBBBDugoCAACADQYQDaiADQZADahD/gICAAAJAIAMoAoQDRQ0AIAxBwNfCgABqQcgAaiERDAELQQMhDSADQZADaiACIAEjgYCAgAAiDEHlpsCAAGpBAxDugoCAACADQYQDaiADQZADahD/gICAAAJAIAMoAoQDRQ0AIAxBwNfCgABqQeAAaiERDAELQQIhDSADQZADaiACIAEjgYCAgAAiDEHypsCAAGpBAhDugoCAACADQYQDaiADQZADahD/gICAAAJAIAMoAoQDRQ0AIAxBwNfCgABqQfgAaiERDAELQQMhDSADQZADaiACIAEjgYCAgAAiDEH4psCAAGpBAxDugoCAACADQYQDaiADQZADahD/gICAAAJAIAMoAoQDRQ0AIAxBwNfCgABqQZABaiERDAELQQMhDSADQZADaiACIAEjgYCAgAAiDEHUo8CAAGpBAxDugoCAACADQYQDaiADQZADahD/gICAAAJAIAMoAoQDRQ0AIAxBwNfCgABqQagBaiERDAELQQIhDSADQZADaiACIAEjgYCAgAAiDEGPp8CAAGpBAhDugoCAACADQYQDaiADQZADahD/gICAACADKAKEA0UNASAMQcDXwoAAakHAAWohEQsCQCADKAKIAyIMRQ0AAkACQCAMIAFJDQAgDCABRg0CDAELIAIgDGosAABBv39KDQELIAIgAUEAIAwjgYCAgABBmNnCgABqEPCCgIAAAAsgA0EwaiACIAwQl4CAgAAgAygCNCESIAMoAjAhEwJAIAwgDWoiDEUNAAJAAkAgASAMSw0AIAEgDEYNAgwBCyACIAxqLAAAQb9/Sg0BCyACIAEgDCABI4GAgIAAQajZwoAAahDwgoCAAAALIAIgDGohDyABIAxrIQ5BACENAkACQANAIA8gDWohAQJAAkAgDiANayIMQQdLDQAgDiANRg0DQQAhAgNAIAEgAmotAABBOkYNAiAMIAJBAWoiAkcNAAwECwsgA0EoakE6IAEgDBD5goCAACADKAIoQQFxRQ0CIAMoAiwhAgsCQCACIA1qIgIgDk8NACAPIAJqLQAAQTpHDQAgA0EgaiAPIAIQl4CAgABBACENAkACQCADKAIkIgFBAEgNAAJAIAENAEEBIQwMAgsgAygCICEUEJiBgIAAQQEhDSABQQEQlYGAgAAiDEUNACABRQ0BIAwgFCAB/AoAAAwBCyANIAEQx4KAgAAACwJAAkACQAJAIA4gAkEBaiICTQ0AIA8gAmosAABBv39MDQELIANBGGogDyACaiAOIAJrEJeAgIAA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ACIKRQ0BAkAgBEUNACAKIAkgBPwKAAALIARBAWohAgsCQAJAIAYgAksNACAGIAJGDQEMBAsgCSACaiwAAEFASA0DCyADQRhqIAkgAmogBiACaxCXgICAAEEAIQYgAygCGCECAkACQCADKAIcIgENAEEAIQEMAQsgAi0AAEE6Rw0AIAJBAWohAiABQX9qIQELIANBEGogAiABEJeAgIAAIAMoAhQiAkEASA0BIAJFDQcgAygCECEBEJiBgIAAQQEhBiACQQEQlYGAgAAiCEUNASACRQ0KIAggASAC/AoAAAwKCyACIAQQx4KAgAAACyAGIAIQx4KAgAAACyAJIAYgAiAGI4GAgIAAQdjZwoAAahDwgoCAAAALIAYgBEEBaiIETw0ADAsLCyADQdAAaiABQQZqIAhBemoQl4CAgABBACECAkACQAJAIAMoAlQiC0EASA0AAkAgCw0AQQEhBkEBIQwMAwsgAygCUCEBEJiBgIAAQQEhAiALQQEQlYGAgAAiBg0BIAshDAsgAiAMEMeCgIAAAAsCQCALRQ0AIAYgASAL/AoAAAsgBiEMCyALIQQgB0EATA0MDAgLA0AgA0E4akE6IAEgAhD6goCAACADKAI4QQFHDQkCQCABIAMoAjwiAmotAABBOkYNACACIAhLDQoMAQsLIANBMGogASACEJeAgIAAQQAhBgJAAkAgAygCNCIEQQBIDQACQCAEDQBBASEKDAILIAMoAjAhCRCYgYCAAEEBIQYgBEEBEJWBgIAAIgpFDQAgBEUNASAKIAkgBPwKAAAMAQsgBiAEEMeCgIAAAAsCQCAIIAJBAWoiAk0NACABIAJqLAAAQb9/TA0CCyADQShqIAEgAmogCCACaxCXgICAAEEAIQEgAygCLCICQQBIDQQgAg0CC0EBIQhBACECDAILIAEgCCACIAgjgYCAgABByNnCgABqEPCCgIAAAAsgAygCKCEGEJiBgIAAQQEhASACQQEQlYGAgAAiCEUNASACRQ0AIAggBiAC/AoAAAsgBEUNASADQaABaiAIIAIQhYOAgAAgAy0AoAFBAUYNASADKwOoASINvSIOQv///////////wCDIg9QIA9Cf3xC/////////wdUIA5CAFMiAXFyIA9CgICAgICAgPj/AFFyIA9CgICAgICAgPj/AFVyIA9CgICAgICAgHh8QoCAgICAgIDw/wBUIAFxcg0BAkAgAkUNACAIIAJBARCWgYCAAAsCQCADKAJ0IgEgAygCbEcNACADQewAahDsgICAAAsgAygCcCABQRhsaiICIAQ2AhAgAiAKNgIMIAIgBDYCCCACIA05AwAgAyABQQFqNgJ0DAQLIAEgAhDHgoCAAAALAkAgAkUNACAIIAJBARCWgYCAAAsgBEUNAiAKIARBARCWgYCAAAwCCyADQcgAaiABQQNqIAhBfWoQl4CAgAAgAygCTCICQQZJDQMgAygCSCIBKAAAQfTS0eMGcyABQQRqLwAAQeXAAHNyDQMgA0HAAGogAUEGaiACQXpqEJeAgIAAQQAhAgJAAkACQCADKAJEIgtBAEgNAAJAIAsNAEEBIQZBASEQDAMLIAMoAkAhARCYgYCAAEEBIQIgC0EBEJWBgIAAIgYNASALIRALIAIgEBDHgoCAAAALAkAgC0UNACAGIAEgC/wKAAALIAYhEAsgCyEEIAdBAEwNBAsgBSAHQQEQloGAgAAgCyEEDAMLIANBCGogA0H4AGoQ9ICAgAAgAygCDCECIAMoAggiAQ0ACyAFIQYgByEEDAMLIAUhBiAHIQQLIAMgA0H4AGoQ9ICAgAAgAygCBCECIAMoAgAiAQ0ACwsCQAJAIAMoAnRFDQAgACADKAJ0NgIIIAAgAykCbDcCACAAIAs2AhQgACAGNgIQIAAgBDYCDAwBCyAAQX82AgACQCADKAJsIgJFDQAgAygCcCACQRhsQQgQloGAgAALIARBAUgNACAGIARBARCWgYCAAAsgA0GwAWokgICAgAALvyABGn8jgICAgABBwAJrIgMkgICAgAAgA0EANgKUASADQoCAgIDAADcCjAEgA0EAOwG8ASADIAI2ArgBIANBADYCtAEgA0EBOgCwASADQQo2AqwBIAMgAjYCqAEgA0EANgKkASADIAI2AqABIAMgATYCnAEgA0EKNgKYASADQYABaiADQZgBahD0gICAAAJAAkAgAygCgAEiAQ0AQX8hBAwBCyADQegBakEMaiEFIAMoAoQBIQJBfyEEA0ACQAJAIAINAEEAIQIMAQsgASACQX9qIgZqLQAAQQpHDQAgAkF+aiECAkACQCAGDQBBACEHDAELIAFBACABIAJqLQAAQQ1GGyEHCyACIAYgBxshAiAHIAEgBxshAQsgA0H4AGogASACEJeAgIAAAkACQCADKAJ8IgJFDQAgAygCeCEBIAJBBUkNAQJAAkACQAJAAkACQAJAAkACQAJAAkACQCABKAAAQefCuaMHcyABQQRqIgYtAABB9ABzckUNACACQQVGDQ0gASgAAEH00tHjBnMgBi8AAEHlwABzckUNASACQQhJDQ0gASkAAELzyo2jl+2btyBSDQ0gA0HwAGogAUEIaiACQXhqEJeAgIAAQQAhASADKAJ0IgJBAEgNAyACDQJBASEIDAULIANB4ABqIAFBBWogAkF7ahCXgICAACADKAJkIgJBBkkNCyADKAJgIgEoAABB9NLR4wZzIAFBBGovAABB5cAAc3INCyADQdgAaiABQQZqIAJBemoQl4CAgABBACECIAMoAlwiCUEASA0HIAkNBkEBIQoMCgsgA0HoAGogAUEGaiACQXpqEJeAgIAAQQAhAgJAIAMoAmwiCUEASA0AAkAgCQ0AQQEhCwwKCyADKAJoIQEQmIGAgABBASECIAlBARCVgYCAACILDQUgCSELCyACIAsQx4KAgAAACyADKAJwIQYQmIGAgABBASEBIAJBARCVgYCAACIIDQEgAiEICyABIAgQx4KAgAAACyACRQ0AIAggBiAC/AoAAAsCQCADKAKUASIGIAMoAowBRw0AIANBjAFqEOiAgIAACyADKAKQASAGQRhsaiIBQQA2AhQgAUKAgICAwAA3AgwgASACNgIIIAEgCDYCBCABIAI2AgAgAyAGQQFqNgKUAQwGCyAJRQ0DIAsgASAJ/AoAAAwDCyADKAJYIQEQmIGAgABBASECIAlBARCVgYCAACIKDQEgCSEKCyACIAoQx4KAgAAACyAJRQ0BIAogASAJ/AoAAAwBCwJAIARBAUgNACAMIARBARCWgYCAAAsgCyEMIAkhBAwBCwJAIARBAUgNACAMIARBARCWgYCAAAsgCiEMIAkhBAsgA0EIaiADQZgBahD0gICAACADKAIMIQIgAygCCCIBRQ0CDAELIANBATsB5AEgAyACNgLgASADQQA2AtwBIANBAToA2AEgA0E6NgLUASADIAI2AtABIANBADYCzAEgAyACNgLIASADIAE2AsQBIANBOjYCwAEgA0HQAGogA0HAAWoQ9YCAgAACQCADKAJQIgJFDQAgA0HIAGogAiADKAJUEJeAgIAAQQAhAQJAAkAgAygC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4ICAgAAMEgsgAEF/NgIADBELIANBEGogAiABEP2AgIAAAkAgAygCEEF/Rg0AIAMgAykCIDcCrAEgAyADKQIYNwKkASADIAMpAhA3ApwBIANBhICAgHg2ApgBEJiBgIAAQYABQQEQlYGAgAAiAkUNBCADQQA2AvgBIAMgAjYC9AEgA0GAATYC8AEgAyADQfABajYC/AECQCADQZgBaiADQfwBahDJgICAACICRQ0AIAMoAvABIgFFDQ8gAygC9AEgAUEBEJaBgIAADA8LIAMoAvQBIQIgAygC8AEiAUF/Rg0OIAAgAygC+AE2AgggACACNgIEIAAgATYCAAwPCyAAQX82AgAMEAsgAyADKQIgNwKsASADIAMpAhg3AqQBIAMgAykCEDcCnAEgA0GDgICAeDYCmAEQmIGAgABBgAFBARCVgYCAACICRQ0DIANBADYC+AEgAyACNgL0ASADQYABNgLwASADIANB8AFqNgL8AQJAIANBmAFqIANB/AFqEMmAgIAAIgJFDQAgAygC8AEiAUUNCyADKAL0ASABQQEQloGAgAAMCwsgAygC9AEhAiADKALwASIBQX9GDQogACADKAL4ATYCCCAAIAI2AgQgACABNgIADAsLIANBEGogAiABEIGBgIAAAkAgAygCEEF/Rg0AIAMgAykCIDcCrAEgAyADKQIYNwKkASADIAMpAhA3ApwBIANBgoCAgHg2ApgBEJiBgIAAQYABQQEQlYGAgAAiAkUNBCADQQA2AvgBIAMgAjYC9AEgA0GAATYC8AEgAyADQfABajYC/AECQCADQZgBaiADQfwBahDJgICAACICRQ0AIAMoAvABIgFFDQkgAygC9AEgAUEBEJaBgIAADAkLIAMoAvQBIQIgAygC8AEiAUF/Rg0IIAAgAygC+AE2AgggACACNgIEIAAgATYCAAwJCyAAQX82AgAMDgsgA0EQaiACIAEQgIGAgAACQCADKAIQQX9GDQAgAyADKQIgNwKsASADIAMpAhg3AqQBIAMgAykCEDcCnAEgA0GBgICAeDYCmAEQmIGAgABBgAFBARCVgYCAACICRQ0EIANBADYC+AEgAyACNgL0ASADQYABNgLwASADIANB8AFqNgL8AQJAIANBmAFqIANB/AFqEMmAgIAAIgJFDQAgAygC8AEiAUUNBiADKAL0ASABQQEQloGAgAAM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tAEhByADKAKwASEPCwNAAkAgAkEIaigCACAHRw0AIAJBBGooAgAgDyAHEK6CgIAARQ0DCyACQQxqIgIgAUcNAAsLIANBlAFqIAQQzoKAgAACQCADKAJcIgIgAygCVEcNACADQdQAahD6gYCAAAsgAygCWCACQQxsaiIBIAMoApwBNgIIIAEgAykClAE3AgAgAyACQQFqNgJcCwJAIAUgAygCYEcNACADQeAAahDngICAACADKAJkIQYLIAYgBUEobGoiAiADKQKgATcCACACIAMpAsABNwIgIAIgAykCuAE3AhggAiADKQKwATcCECACIAMpAqgBNwIIIAMgBUEBaiIFNgJoCyADQQhqIANB7ABqEPSAgIAAIAMoAgwhAiADKAIIIgENAAsLAkACQCADKAJcRQ0AIAAgAykCVDcCACADIAMoAlw2AqgBIAMgAykCYDcCrAEgACADKQOoATcCCCADIAMoAmg2ArQBIAAgAykDsAE3AhAMAQsgAEF/NgIAIANB4ABqELuAgIAAIAMoAlghCAJAIAMoAlwiAUUNACAIIQIDQAJAIAIoAgAiB0UNACACQQRqKAIAIAdBARCWgYCAAAsgAkEMaiECIAFBf2oiAQ0ACwsgAygCVCICRQ0AIAggAkEMbEEEEJaBgIAACyADQeABaiSAgICAAAv3JAUPfwJ+DX8CfAd/I4CAgIAAQYADayIDJICAgIAAEJiBgIAAAkACQEEwQQQQlYGAgAAiBEUNAEF/IQUgBEF/NgIkIARBfzYCGCAEQX82AgwgBEF/NgIAQQAhBiADQQA2AsQBIANCgICAgIABNwK8ASADQQA7AewBIAMgAjYC6AEgA0EANgLkAUEBIQcgA0EBOgDgASADQQo2AtwBIAMgAjYC2AEgA0EANgLUASADIAI2AtABIAMgATYCzAEgA0EKNgLIASOJgICAACECIANBsAFqIANByAFqEPSAgIAAAkAgAygCsAEiAQ0AQQAhCEEAIQlBASEKQQAhC0EAIQxBASENQQAhDkEAIQ9BASEQQQAhEQwCCyACrUIghiISIANB9AJqrYQhEyASIANBxwJqrYQhEiADKAK0ASECQX8hBUEAIRFBASEQQQAhD0EAIQ5BASENQQAhDEEAIQtBASEKQQAhCUEAIQhBASEHQQAhBgNAAkACQCACDQBBACECDAELIAEgAkF/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A0EsNgLcAiADIAI2AtgCIANBADYC1AIgAyACNgLQAiADIAE2AswCIANBLDYCyAIgA0E4aiADQcgCahD1gICAACADKAI4IgJFDQQgAygCPCEBEJiBgIAAQSBBBBCVgYCAACIZRQ0BIBkgAjYCACAZIAE2AgRBASECIANBATYC/AIgAyAZNgL4AiADQQQ2AvQCIAMgAykC6AI3A5ACIAMgAykC4AI3A4gCIAMgAykC2AI3A4ACIAMgAykC0AI3A/gBIAMgAykCyAI3A/ABIANBMGogA0HwAWoQ9YCAgAACQCADKAIwIhRFDQAgAygCNCEVQQEhAkEMIQEDQAJAIAIgAygC9AJHDQAgA0H0AmogAkEBQQRBCBCagICAACADKAL4AiEZCyAZIAFqIhogFTYCACAaQXxqIBQ2AgAgAyACQQFqIgI2AvwCIAFBCGohASADQShqIANB8AFqEPWAgIAAIAMoAiwhFSADKAIoIhQNAAsLIAMoAvQCIRQgAygC+AIhAQJAIAJBAkcNACADQSBqIAEoAgAgASgCBBCXgICAACADQfABaiADKAIgIAMoAiQQhYOAgAAgAysD+AEhISADLQDwASECIANBGGogASgCCCABKAIMEJeAgIAAIANB8AFqIAMoAhggAygCHBCFg4CAACAbRQ0ARAAAAAAAAPh/ICEgAhsiIb1CAYZC/////////29WDQBEAAAAAAAA+H8gAysD+AEgAy0A8AEbIiK9QgGGQv////////9vVg0AAkAgAygCxAEiFSADKAK8AUcNACADQbwBahDpgICAAAsgAygCwAEgFUEFdGoiAiAbNgIYIAIgHzYCFCACIBs2AhAgAiAiOQMIIAIgITkDACADIBVBAWo2AsQBIBRFDQkgASAUQQN0QQQQloGAgAAMCQsgFEUNBCABIBRBA3RBBBCWgYCAAAwECyAZIBUgASACI4GAgIAAQfjZwoAAahDwgoCAAAALQQRBIBDHgoCAAAALIBUgAkEBaiIaTw0ACwsgG0UNAyAfIBtBARCWgYCAAAwDCyAWIAEgAiABI4GAgIAAQejZwoAAahDwgoCAAAALIAEgAkEBaiIaTw0ACwsgA0EQaiADQcgBahD0gICAACADKAIUIQIgAygCECIBRQ0HDAULAkAgAkUNACAXIBQgAvwKAAALAkAgBUEBSA0AICMgBUEBEJaBgIAACyACISQgFyEjIAIhBQwDCyADQfABaiAWQQdqIAFBeWoiAiOBgICAAEHUo8CAAGpBAxDugoCAACADQQE7AbgCIAMgAjYCtAIgA0EANgKwAiADQcgCaiADQfABahCFgYCAAAJAIAMoAtACQQJHDQAgA0GYAWogAygCzAIiAigCACACKAIEEJeAgIAAQQAhAgJAAkACQCADKAKcASIJQQBIDQACQCAJDQBBASElDAMLIAMoApgBIQEQmIGAgABBASECIAlBARCVgYCAACIlDQEgCSElCyACICUQx4KAgAAACyAJRQ0AICUgASAJ/AoAAAsCQAJAAkAgC0UNACAKIAtBARCWgYCAACADKALQAiICQQFNDQELIANBkAFqIAMoAswCIgIoAgggAigCDBCXgICAAEEAIQICQAJAIAMoApQBIgZBAEgNAAJAIAYNAEEBISYMBAsgAygCkAEhARCYgYCAAEEBIQIgBkEBEJWBgIAAIiYNASAGISYLIAIgJhDHgoCAAAALIAZFDQEgJiABIAb8CgAADAELQQEgAiOBgICAAEGY2sKAAGoQ5IKAgAAACwJAIAhFDQAgByAIQQEQloGAgAALICYhByAGIQggJSEKIAkhCwsgAygCyAIiAkUNAiADKALMAiACQQN0QQQQloGAgAAMAgsgA0HwAWogFkEHaiABQXlqIgIjgYCAgABB1KPAgABqQQMQ7oKAgAAgA0EBOwG4AiADIAI2ArQCIANBADYCsAIgA0HIAmogA0HwAWoQhYGAgAACQCADKALQAkECRw0AIANBiAFqIAMoAswCIgIoAgAgAigCBBCXgICAAEEAIQICQAJAAkAgAygCjAEiD0EASA0AAkAgDw0AQQEhJwwDCyADKAKIASEBEJiBgIAAQQEhAiAPQQEQlYGAgAAiJw0BIA8hJwsgAiAnEMeCgIAAAAsgD0UNACAnIAEgD/wKAAALAkACQAJAIBFFDQAgECARQQEQloGAgAAgAygC0AIiAkEBTQ0BCyADQYABaiADKALMAiICKAIIIAIoAgwQl4CAgABBACECAkACQCADKAKEASIMQQBIDQACQCAMDQBBASEoDAQLIAMoAoABIQEQmIGAgABBASECIAxBARCVgYCAACIoDQEgDCEoCyACICgQx4KAgAAACyAMRQ0BICggASAM/AoAAAwBC0EBIAIjgYCA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CwJAIAFBARCigYCAAEUNACABKAIYIQwgAiABKAKMATYCqAEgAiABKQKEATcDoAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhCyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBmAFqIAEQ24CAgAAgAigCnAEhAQJAIAIoApgBQQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBkAFqIAEQsoCAgAAgAigClAEhAQJAIAIoApABQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBiAFqIAEQsoCAgAAgAigCjAEhAQJAIAIoAogBIgNBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsCQCADQQFxDQADQAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQYABaiABELKAgIAAIAIoAoQBIQECQCACKAKAASIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAACACQfgAaiABENqAgIAAIAIoAnwhASACKAJ4QQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAEoAowBNgLYASACIAEpAoQBNwPQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJB8ABqIAEQsoCAgAAgAigCdCEBAkAgAigCcEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghDyACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQegAaiABELKAgIAAIAIoAmwhAQJAIAIoAmgiA0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB4ABqIAEQsoCAgAAgAigCZCEBAkAgAigCYCIDQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCAPIAEoAhhLDQAgASAPNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIANBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIA4gASgCGEsNACABIA42AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAACACQdgAaiABENuAgIAAIAIoAlwhASACKAJYQQFxDQACQCABQQEQooGAgAANAEEBIQsMAQsgASgCGCEOIAIgASgCjAE2ArgBIAIgASkChAE3A7ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAIAFBARCigYCAAEUNAEEBIQMCQCABQQEQooGAgABFDQAgASgCGCEQIAIgAUGEAWoiCygCCDYCyAEgAiALKQIANwPAASABKAI8IQ0CQCABKAJUIg8gASgCTEcNACABQcwAahCmgICAAAtBASEDIAEgD0EBajYCVCABKAJQIA9BA3RqIg8gDTYCBCAPIA02AgACQCABQQEQooGAgABFDQAgASgCGCEPIAIgCygCCDYC2AEgAiALKQIANwPQASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJB0ABqIAEQsoCAgAAgAigCVCEBAkAgAigCUEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASELDAELIAEoAhghESACIAEoAowBNgLoASACIAEpAoQBNwPgASABKAI8IQsCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSALNgIEIA0gCzYCACACQcgAaiABELKAgIAAIAIoAkwhAQJAIAIoAkgiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAtBAXENAANAAkACQCABQQEQooGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJBwABqIAEQsoCAgAAgAigCRCEBAkAgAigCQCILQQFHDQAgASACKALoATYCjAEgASACKQPgATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALIAtBAUcNAAsLIAEtAAxBAkYNAgsgAS0ADEECRg0BCyABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIA8gASgCGEsNACABIA82AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAACACQThqIAEQ2oCAgAAgAigCPCEBIAIoAjhBAXENACABQQEQooGAgABFDQAgASgCGCEPIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAAkACQCABQQEQooGAgABFDQAgAkEwaiABELKAgIAAIAIoAjQhAQJAIAIoAjBBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhCwwBCyABKAIYIREgAiABKAKMATYC6AEgAiABKQKEATcD4AEgASgCPCELAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gCzYCBCANIAs2AgAgAkEoaiABELKAgIAAIAIoAiwhAQJAIAIoAigiC0EBRw0AIAEgAigC6AE2AowBIAEgAikD4AE3AoQBAkAgESABKAIYSw0AIAEgETYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAtBAXENAANAAkACQCABQQEQooGAgAANAEEBIQsMAQsgASgCGCERIAIgASgCjAE2AugBIAIgASkChAE3A+ABIAEoAjwhCwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAs2AgQgDSALNgIAIAJBIGogARCygICAACACKAIkIQECQCACKAIgIgtBAUcNACABIAIoAugBNgKMASABIAIpA+ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgC0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigC2AE2AowBIAEgAikD0AE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBGGogARDbgICAACACKAIcIQEgAigCGCEDCwJAIANBAUcNACABIAIoAsgBNgKMASABIAIpA8ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASELAkACQCADQQFxRQ0AIAMhCwwBCyABQQEQooGAgABFDQAgAkEQaiABENmAgIAAIAIoAhQhAQJAIAIoAhBBAXENAANAIAJBCGogARDZgICAACACKAIMIQEgAigCCEEBcUUNAAsLIAEtAAxBAkchCwsCQCALQQFHDQAgAS0ADEECRw0BC0EAIQsLAkAgC0EBRw0AIAEgAigCuAE2AowBIAEgAikDsAE3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIAtBAUcNACABIAIoAqgBNgKMASABIAIpA6ABNwKEAQJAIAwgASgCGEsNACABIAw2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDIAEtAJQBIQ0CQAJAAkACQAJAAkAgC0EBRw0AIA1B/wFxQQFGDQYgAS0AlQFFDQMgASgCkAEiAyAGRw0BAkAgASgCMCIGIAEoAiQiA2oiCyAITQ0AIAsgCGtBAUYNBAsCQCAFIANLDQAgASAFNgIkIAUhAwsgBCAGSw0CIAEgBDYCMAwCCyANQf8BcUEBRw0DIAEtAJUBRQ0EAkACQCABKAKQASIDIAZHDQACQCABKAIwIgMgASgCJCIGaiILIAhNDQAgCyAIa0EBRg0HCwJAIAUgBksNACABIAU2AiQLIAQgA0sNASABIAQ2AjAgBCEDDAELIAYgA00NBSABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCKEcNACABQShqEKGAgIAACyABKAIsIANqQQk6AAAgASADQQFqNgIwIAEtAJQBIQ0MAwsgBiADTQ0BIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIcRw0AIAFBHGoQoYCAgAALIAEgA0EBajYCJCABKAIgIANqQQk6AAALQQEhAwJAIAEtAIABQQFHDQAgAS0AlQFFDQAgAUHYAGpBCUEAIAogASgCfCAJSxsQooCAgAALIAEtAJQBQQJHDQIgAS0AlQFFDQIgByABKAIYSw0CIAEgBzYCGAwCCyANQf8BcUECRw0AIAEtAJUBRQ0AAkACQCAHIAEoAhgiA08NACABKAIUIAdBFGxqIgstAAANASALIAM2AgQgASgCjAEhBgJAIAEoAhgiCyABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgC0EUbGoiAyAGNgIQIANBADYCCCADIAc2AgQgA0GBEjsBACABIAtBAWo2AhgMAgsgByADI4GAgIAAQfzSwoAAahDkgoCAAAALI4GAgIAAIgFBuZ7AgABqQSggAUGM08KAAGoQ1oKAgAAAC0EAIQMgAS0AgAFFDQAgAS0AlQFFDQBBACEDIAFB2ABqQQlBACAKIAEoAnwgCUsbEKKAgIAACyAAIAE2AgQgACADNgIAIAJB8AFqJICAgIAAC5gQAQ5/I4CAgIAAQeAAayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQCABQQEQooGAgABFDQAgASgCGCEMIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEoaiABEIqBgIAAIAIoAiwhAQJAIAIoAihBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AkggAiABKQKEATcDQCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCAAJAAkAgAUEBEKKBgIAARQ0AIAJBIGogARCygICAACACKAIkIQECQCACKAIgQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRhqIAEQsoCAgAAgAigCHCEBAkAgAigCGCIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2AlggAiABKQKEATcDUCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAJYNgKMASABIAIpA1A3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQILIAEtAAxBAkYNAQsgASACKAJINgKMASABIAIpA0A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAQQEhCyABQQEQooGAgABFDQAgAkEIaiABEI2BgIAAIAIoAgwhAQJAIAIoAggiC0EBRw0AIAEtAAxBAkcNAQtBACELCwJAIAtBAUcNACABIAIoAjg2AowBIAEgAikDMDcChAECQCAMIAEoAhhLDQAgASAMNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALQQEhAyABLQCUASENAkACQAJAAkACQAJAIAtBAUcNACANQf8BcUEBRg0GIAEtAJUBRQ0DIAEoApABIgMgBkcNAQJAIAEoAjAiBiABKAIkIgNqIgsgCE0NACALIAhrQQFGDQQLAkAgBSADSw0AIAEgBTYCJCAFIQMLIAQgBksNAiABIAQ2AjAMAgsgDUH/AXFBAUcNAyABLQCVAUUNBAJAAkAgASgCkAEiAyAGRw0AAkAgASgCMCIDIAEoAiQiBmoiCyAITQ0AIAsgCGtBAUYNBwsCQCAFIAZLDQAgASAFNgIkCyAEIANLDQEgASAENgIwIAQhAwwBCyAGIANNDQUgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAihHDQAgAUEoahChgICAAAsgASgCLCADakEKOgAAIAEgA0EBajYCMCABLQCUASENDAMLIAYgA00NASABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCHEcNACABQRxqEKGAgIAACyABIANBAWo2AiQgASgCICADakEKOgAAC0EBIQMCQCABLQCAAUEBRw0AIAEtAJUBRQ0AIAFB2ABqQQpBACAKIAEoAnwgCUsbEKKAgIAACyABLQCUAUECRw0CIAEtAJUBRQ0CIAcgASgCGEsNAiABIAc2AhgMAgsgDUH/AXFBAkcNACABLQCVAUUNAAJAAkAgByABKAIYIgNPDQAgASgCFCAHQRRsaiILLQAADQEgCyADNgIEIAEoAowBIQYCQCABKAIYIgsgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAtBFGxqIgMgBjYCECADQQA2AgggAyAHNgIEIANBgRQ7AQAgASALQQFqNgIYDAILIAcgAyOBgICAAEH80sKAAGoQ5IKAgAAACyOBgICAACIBQbmewIAAakEoIAFBjNPCgABqENaCgIAAAAtBACEDIAEtAIABRQ0AIAEtAJUBRQ0AQQAhAyABQdgAakEKQQAgCiABKAJ8IAlLGxCigICAAAsgACABNgIEIAAgAzYCACACQeAAaiSAgICAAAu8CwEMfyOAgICAAEEQayICJICAgIAAQQEhAwJAIAFBARCigYCAAEUNAEEAIQRBACEFAkAgASgCjAEiBiABKAKQASIDRw0AIAEoAjAhBCABKAIkIQULIAEoAhghBwJAIAEtAJQBQQJHDQAgAS0AlQFFDQACQCAHIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIQQAhCQJAIAMgBkcNACABKAIwIAEoAiRqIQkLAkAgASgCjAEiA0F6Sw0AIANBBWoiCiABKAKIAUsNACABKAKEASADaiILKAAAQefkhYMHcyALQQRqLQAAQegAc3INACABIAo2AowBQQEhCAsgASgCfCEKIAEoAmAhDAJAAkACQAJAAkAgAS0AgAFBAUcNABCYgYCAAEEFQQEQlYGAgAAiC0UNASALI4GAgIAAQZCjwIAAaiINLQAEOgAEIAsg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IAJBGGogARCygICAACACKAIcIQECQCACKAIYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCENIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgASALQQFqNgJUIAEoAlAgC0EDdGoiCyADNgIEIAsgAzYCACACQRBqIAEQsoCAgAAgAigCFCEBAkAgAigCECIDQQFHDQAgASACKAI4NgKMASABIAIpAzA3AoQBAkAgDSABKAIYSw0AIAEgDTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCENIAIgASgCjAE2AjggAiABKQKEATcDMCABKAI8IQMCQCABKAJUIgsgASgCTEcNACABQcwAahCmgICAAAsgASALQQFqNgJUIAEoAlAgC0EDdGoiCyADNgIEIAsgAzYCACACQQhqIAEQsoCAgAAgAigCDCEBAkAgAigCCCIDQQFHDQAgASACKAI4NgKMASABIAIpAzA3AoQBAkAgDSABKAIYSw0AIAEgDTYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACyADQQFHDQALCyABLQAMQQJGDQMLIAEtAAxBAkYNAgsgASACKAJINgKMASABIAIpA0A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAtBASELDAELIAFBNGoQqYCAgAAgAiABEKWAgIAAIAIoAgQhASACKAIAIQsLAkAgC0EBRw0AIAEgAigCKDYCjAEgASACKQMgNwKEAQJAIAwgASgCGEsNACABIAw2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAtBASEDIAEtAJQBIQ4CQAJAAkACQCALQQFHDQAgDkH/AXFBAUYNCCABLQCVAUUNAyABKAKQASIDIAZHDQECQCABKAIwIgYgASgCJCIDaiILIAhNDQAgCyAIa0EBRg0ECwJAIAUgA0sNACABIAU2AiQgBSEDCyAEIAZLDQIgASAENgIwDAILIA5B/wFxQQFHDQUgAS0AlQFFDQYCQAJAIAEoApABIgMgBkcNAAJAIAEoAjAiAyABKAIkIgZqIgsgCE0NACALIAhrQQFGDQkLAkAgBSAGSw0AIAEgBTYCJAsgBCADSw0BIAEgBDYCMCAEIQMMAQsgBiADTQ0HIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIoRw0AIAFBKGoQoYCAgAALIAEoAiwgA2pBFDoAACABIANBAWo2AjAgAS0AlAEhDgwFCyAGIANNDQEgASAGNgKQAUEAIQMgAUEANgIwIAFBADYCJAsCQCADIAEoAhxHDQAgAUEcahChgICAAAsgASADQQFqNgIkIAEoAiAgA2pBFDoAAAtBASEDIAEtAIABQQFHDQEgAS0AlQFFDQEgAUHYAGpBFEEAIAogASgCfCAJSxsQooCAgAAMAQtBAUEDEMeCgIAAAAsgAS0AlAFBAkcNAiABLQCVAUUNAiAHIAEoAhhLDQIgASAHNgIYDAILIA5B/wFxQQJHDQAgAS0AlQFFDQACQAJAIAcgASgCGCIDTw0AIAEoAhQgB0EUbGoiCy0AAA0BIAsgAzYCBCABKAKMASEGAkAgASgCGCILIAEoAhBHDQAgAUEQahCfgICAAAsgASgCFCALQRRsaiIDIAY2AhAgA0EANgIIIAMgBzYCBCADQYEoOwEAIAEgC0EBajYCGAwCCyAHIAMjgYCAgABB/NLCgABqEOSCgIAAAAsjgYCAgAAiAUG5nsCAAGpBKCABQYzTwoAAahDWgoCAAAALQQAhAyABLQCAAUUNACABLQCVAUUNAEEAIQMgAUHYAGpBFEEAIAogASgCfCAJSxsQooCAgAALIAAgATYCBCAAIAM2AgAgAkHQAGokgICAgAALigkBC38jgICAgABBIGsiAiSAgICAAEEBIQMCQCABQQEQooGAgABFDQBBACEEQQAhBQJAIAEoAowBIgYgASgCkAEiA0cNACABKAIwIQQgASgCJCEFCyABKAIYIQcCQCABLQCUAUECRw0AIAEtAJUBRQ0AAkAgByABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgB0EUbGoiAyAGNgIIIANBADYCBCADQQA6AAAgASAHQQFqNgIYIAEoApABIQMLQQAhCAJAIAMgBkcNACABKAIwIAEoAiRqIQgLIAEoAnwhCSABKAJgIQogAkEYaiABEIuBgIAAIAIoAhwhAQJAAkACQCACKAIYQQFHDQAgAkEQaiABEK6AgIAAIAIoAhQhASACKAIQQQFHDQAgAkEIaiABEKqAgIAAIAIoAgwhASACKAIIQQFxDQELQQAhCwwBCyACIAEQrICAgAAgAigCBCEBIAIoAgAhCwtBASEDIAEtAJQBIQwCQAJAAkACQAJAAkAgC0EBRw0AIAxB/wFxQQFGDQYgAS0AlQFFDQMgASgCkAEiAyAGRw0BAkAgASgCMCIMIAEoAiQiA2oiBiAITQ0AIAYgCGtBAUYNBAsCQCAFIANLDQAgASAFNgIkIAUhAwsgBCAMSw0CIAEgBDYCMAwCCyAMQf8BcUEBRw0DIAEtAJUBRQ0EAkACQCABKAKQASIDIAZHDQACQCABKAIwIgMgASgCJCIMaiIGIAhNDQAgBiAIa0EBRg0HCwJAIAUgDEsNACABIAU2AiQLIAQgA0sNASABIAQ2AjAgBCEDDAELIAYgA00NBSABIAY2ApABQQAhAyABQQA2AjAgAUEANgIkCwJAIAMgASgCKEcNACABQShqEKGAgIAACyABKAIsIANqQQ06AAAgASADQQFqNgIwIAEtAJQBIQwMAwsgBiADTQ0BIAEgBjYCkAFBACEDIAFBADYCMCABQQA2AiQLAkAgAyABKAIcRw0AIAFBHGoQoYCAgAALIAEgA0EBajYCJCABKAIgIANqQQ06AAALQQEhAwJAIAEtAIABQQFHDQAgAS0AlQFFDQAgAUHYAGpBDUEAIAogASgCfCAJSxsQooCAgAALIAEtAJQBQQJHDQIgAS0AlQFFDQIgByABKAIYSw0CIAEgBzYCGAwCCyAMQf8BcUECRw0AIAEtAJUBRQ0AAkACQCAHIAEoAhgiA08NACABKAIUIAdBFGxqIgYtAAANASAGIAM2AgQgASgCjAEhDAJAIAEoAhgiBiABKAIQRw0AIAFBEGoQn4CAgAALIAEoAhQgBkEUbGoiAyAMNgIQIANBADYCCCADIAc2AgQgA0GBGjsBACABIAZBAWo2AhgMAgsgByADI4GAgIAAQfzSwoAAahDkgoCAAAALI4GAgIAAIgFBuZ7AgABqQSggAUGM08KAAGoQ1oKAgAAAC0EAIQMgAS0AgAFFDQAgAS0AlQFFDQBBACEDIAFB2ABqQQ1BACAKIAEoAnwgCUsbEKKAgIAACyAAIAE2AgQgACADNgIAIAJBIGokgICAgAALkykBEX8jgICAgABB4AFrIgIkgICAgABBASEDAkAgAUEBEKKBgIAARQ0AQQAhBEEAIQUCQCABKAKMASIGIAEoApABIgNHDQAgASgCMCEEIAEoAiQhBQsgASgCGCEHAkAgAS0AlAFBAkcNACABLQCVAUUNAAJAIAcgASgCEEcNACABQRBqEJ+AgIAACyABKAIUIAdBFGxqIgMgBjYCCCADQQA2AgQgA0EAOgAAIAEgB0EBajYCGCABKAKQASEDC0EAIQgCQCADIAZHDQAgASgCMCABKAIkaiEICyABKAJ8IQkgASgCYCEKAkACQAJAAkACQAJAAkACQCABQQEQooGAgABFDQAgASgCGCELIAIgASgCjAE2AogBIAIgASkChAE3A4ABIAEoAjwhDAJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQMgASANQQFqNgJUIAEoAlAgDUEDdGoiDSAMNgIEIA0gDDYCAAJAIAFBARCigYCAAEUNACABKAIYIQ4gAiABQYQBaiIDKAIINgKYASACIAMpAgA3A5ABIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQwgASAPQQFqNgJUIAEoAlAgD0EDdGoiDyANNgIEIA8gDTYCAAJAIAFBARCigYCAAEUNACABKAIYIRAgAiADKAIINgK4ASACIAMpAgA3A7ABIAEoAjwhDQJAIAEoAlQiDyABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQwgASAPQQFqNgJUIAEoAlAgD0EDdGoiDyANNgIEIA8gDTYCAAJAIAFBARCigYCAAEUNACABKAIYIQ8gAiADKAIINgLIASACIAMpAgA3A8ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkH4AGogARCvgICAACACKAJ8IQECQCACKAJ4QQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCERIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB8ABqIAEQr4CAgAAgAigCdCEBAkAgAigCcCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIREgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHoAGogARCvgICAACACKAJsIQECQCACKAJoIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBEgASgCGEsNACABIBE2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCyAE2AowBIAEgAikDwAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJB4ABqIAEQ2ICAgAAgAigCZCEBIAIoAmAhDAsCQCAMQQFHDQAgASACKAK4ATYCjAEgASACKQOwATcChAECQCAQIAEoAhhLDQAgASAQNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALQQEhAwJAIAxBAUYNAAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCqAEgAiABKQKEATcDoAEgASgCPCEMAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALQQEhAyABIA1BAWo2AlQgASgCUCANQQN0aiINIAw2AgQgDSAMNgIAAkAgAUEBEKKBgIAARQ0AQQEhDAJAIAFBARCigYCAAEUNACABKAIYIREgAiABQYQBaiIDKAIINgK4ASACIAMpAgA3A7ABIAEoAjwhDQJAIAEoAlQiECABKAJMRw0AIAFBzABqEKaAgIAAC0EBIQwgASAQQQFqNgJUIAEoAlAgEEEDdGoiECANNgIEIBAgDTYCAAJAIAFBARCigYCAAEUNACABKAIYIRAgAiADKAIINgLIASACIAMpAgA3A8ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkHYAGogARCvgICAACACKAJcIQECQCACKAJYQQFxDQAgAUEBEKKBgIAARQ0AAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCESIAIgASgCjAE2AtgBIAIgASkChAE3A9ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJB0ABqIAEQr4CAgAAgAigCVCEBAkAgAigCUCIDQQFHDQAgASACKALYATYCjAEgASACKQPQATcChAECQCASIAEoAhhLDQAgASASNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALAkAgA0EBcQ0AA0ACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIRIgAiABKAKMATYC2AEgAiABKQKEATcD0AEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHIAGogARCvgICAACACKAJMIQECQCACKAJIIgNBAUcNACABIAIoAtgBNgKMASABIAIpA9ABNwKEAQJAIBIgASgCGEsNACABIBI2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0CCyABLQAMQQJGDQELIAEgAigCyAE2AowBIAEgAikDwAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAAIAJBwABqIAEQ2ICAgAAgAigCRCEBIAIoAkAhDAsCQCAMQQFHDQAgASACKAK4ATYCjAEgASACKQOwATcChAECQCARIAEoAhhLDQAgASARNgIYCyABQTRqEKiAgIAADAELIAFBNGoQqYCAgAALQQEhAwJAAkAgDEEBcUUNACAMIQMMAQsgAUEBEKKBgIAARQ0AIAJBOGogARDXgICAACACKAI8IQECQCACKAI4QQFxDQADQCACQTBqIAEQ14CAgAAgAigCNCEB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ASgCFCAHQRRsaiIDIAY2AgggA0EANgIEIANBADoAACABIAdBAWo2AhggASgCkAEhAwtBACEIAkAgAyAGRw0AIAEoAjAgASgCJGohCAsgASgCfCEJIAEoAmAhCkEBIQsCQCABQQEQooGAgABFDQAgASgCGCEMIAIgASgCjAE2AmggAiABKQKEATcDYCABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAtBASELIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHYAGogARCJgYCAACACKAJcIQECQCACKAJYQQFxDQAgAUEBEKKBgIAARQ0AIAEoAhghDiACIAEoAowBNgJ4IAIgASkChAE3A3AgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkHQAGogARCygICAACACKAJUIQECQAJAIAIoAlBBAXENACABQQEQooGAgABFDQAgASgCGCEPIAIgASgCjAE2AogBIAIgASkChAE3A4ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkAgAUEBEKKBgIAARQ0AIAJByABqIAEQsoCAgAAgAigCTCEBAkAgAigCSEEBcQ0AIAFBARCigYCAAEUNAAJAAkAgAUEBEKKBgIAADQBBASEDDAELIAEoAhghECACIAEoAowBNgKYASACIAEpAoQBNwOQASABKAI8IQMCQCABKAJUIg0gASgCTEcNACABQcwAahCmgICAAAsgASANQQFqNgJUIAEoAlAgDUEDdGoiDSADNgIEIA0gAzYCACACQcAAaiABELKAgIAAIAIoAkQhAQJAIAIoAkAiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgECABKAIYSw0AIAEgEDYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEQIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBOGogARCygICAACACKAI8IQECQCACKAI4IgNBAUcNACABIAIoApgBNgKMASABIAIpA5ABNwKEAQJAIBAgASgCGEsNACABIBA2AhgLIAFBNGoQqICAgAAMAQsgAUE0ahCpgICAAAsgA0EBRw0ACwsgAS0ADEECRg0DCyABLQAMQQJGDQILIAEgAigCiAE2AowBIAEgAikDgAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAsgASACKAJ4NgKMASABIAIpA3A3AoQBAkAgDiABKAIYSw0AIAEgDjYCGAsgAUE0ahCogICAAAwBCyABQTRqIgMQqYCAgAAgAxCpgICAACACQTBqIAEQtYCAgAAgAigCNCEBIAIoAjBBAXENACABQQEQooGAgABFDQAgASgCGCEOIAIgASgCjAE2AogBIAIgASkChAE3A4ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAAkACQCABQQEQooGAgABFDQAgAkEoaiABELKAgIAAIAIoAiwhAQJAIAIoAihBAXENACABQQEQooGAgABFDQACQAJAIAFBARCigYCAAA0AQQEhAwwBCyABKAIYIQ8gAiABKAKMATYCmAEgAiABKQKEATcDkAEgASgCPCEDAkAgASgCVCINIAEoAkxHDQAgAUHMAGoQpoCAgAALIAEgDUEBajYCVCABKAJQIA1BA3RqIg0gAzYCBCANIAM2AgAgAkEgaiABELKAgIAAIAIoAiQhAQJAIAIoAiAiA0EBRw0AIAEgAigCmAE2AowBIAEgAikDkAE3AoQBAkAgDyABKAIYSw0AIAEgDzYCGAsgAUE0ahCogICAAAwBCyABQTRqEKmAgIAACwJAIANBAXENAANAAkACQCABQQEQooGAgAANAEEBIQMMAQsgASgCGCEPIAIgASgCjAE2ApgBIAIgASkChAE3A5ABIAEoAjwhAwJAIAEoAlQiDSABKAJMRw0AIAFBzABqEKaAgIAACyABIA1BAWo2AlQgASgCUCANQQN0aiINIAM2AgQgDSADNgIAIAJBGGogARCygICAACAC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IQYgAEEAOgAAIAZFDQAgA0EMaiABI4GAgIAAQdOxwYAAakGdASACKAIkEYKAgIAAgICAgAAgA0EMahCogYCAAAsgBEEAOgAAIANBIGokgICAgAALjgEBA38jgICAgABBEGsiACSAgICAACOBgICAAEHJ5sKAAGoiAS0AACECIAFBAToAACAAIAI6AA8CQCACQQFHDQAjgYCAgAAhAkEAIABBD2ojkYCAgAAgAkGns8GAAGpBwQAgAkHc3sKAAGoQpoGAgAAACyOBgICAACECIABBEGokgICAgAAgAkHJ5sKAAGoLYAEBfyOAgICAAEEQayIEJICAgIAAIAQgAzoAByAEI5KAgIAArUIghiAEQQdqrYQ3AwggACABI4GAgIAAQdqEwIAAaiAEQQhqIAIRgoCAgACAgICAACAEQRBqJICAgIAAC5gDAQN/I4CAgIAAQTBrIgEkgICAgABB/wEhAgJAIAAtAA0NAEEBIQIjgYCAgABB7OXCgABqKAIAQQFLDQAQzIGAgAAhAgsgASACOgALIAEgACgCCDYCDCABIAAoAgAgACgCBBDOgYCAACABIAEpAwA3AhAjgYCAgABBpObCgABqLQAAIQAgASABQQtqNgIgIAEgAUEQajYCHCABIAFBDGo2AhgCQAJAAkAgAEUNACOBgICAACIAQaTmwoAAakEBOgAAIABB6OXCgABqIgIoAgAhACACQQA2AgAgAA0BCyABQRhqIAFBL2ojgYCAgABBoN/CgABqELqBgIAADAELI4GAgIAAIQIgAUEYaiAAQQhqEMmBgIAAIgNBBGogAkHI38KAAGoQuoGAgAAgA0EAOgAAIAJBpObCgABqQQE6AAAgAkHo5cKAAGoiAygCACECIAMgADYCACABIAI2AiggAUEBNgIkIAJFDQAgAiACKAIAIgBBf2o2AgAgAEEBRw0AIAFBJGpBBGoQyoGAgAALIAFBMGokgICAgAALbgEBfyOAgICAAEEgayICJICAgIAAIAIgACABEKWBgIAANgIEIAIjj4CAgACtQiCGIAJBBGqthDcDECACQQhqIAJBH2ojgYCAgABBqZzAgABqIAJBEGoQv4GAgAAgAkEIahCogYCAABC5gYCAAAALuQEBAX8jgICAgABBEGsiBCSAgICAACAAQf8BOgAAIAQgATYCCCAEIAApAgA3AwAgBCOBgICA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ACgCABC9goCAAAsLCgAgABCDgICAAAsEACAACwoAIAAQhICAgAALBAAgAAsKACAAEIWAgIAACwoAIAAQhoCAgAALNQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQh4CAgAAgACABKQIINwIAIAFBEGokgICAgAALDgAgAC0AABCIgICAAAALCgAgABCJgICAAAs/AQF/I4CAgIAAQRBrIgIkgICAgAAgACgCACAAKAIEIAJBCGoQioCAgAAgASACKQIINwIAIAJBEGokgICAgAALdwIBfwF+I4CAgIAAQRBrIgMkgICAgAAgACADEIuAgIAAAkACQAJAAkAgAy0AAA4CAAIBCyADKQMIIQQLIAEgBDcDAEEBIQAMAQsgAiADNQIMQiCGQgAgAzEACCIEUBsgBIQ3AgBBACEACyADQRBqJICAgIAAIAALXAEBfyOAgICAAEEQayIDJICAgIAAIAAgASgCACABKAIEIANBBGoQjICAgAACQCADLQAEQQFHIgENACACIAMtAAg6AAAgAiADKAIMNgIECyADQRBqJICAgIAAIAELUgEBfyOAgICAAEEQayICJICAgIAAIAAgAkEEahCNgICAAAJAIAItAARBAUciAA0AIAEgAi0ACDoAACABIAIoAgw2AgQLIAJBEGokgICAgAAgAAsKACAAEI6AgIAACwgAEI+AgIAACwgAEJCAgIAACwgAEJGAgIAAC0EBAX8jgICAgABBEGsiASSAgICAACABQQhqEJKAgIAAIAAgASgCDDYCACABLQAIIQAgAUEQaiSAgICAACAAQQFGC0EBAX8jgICAgABBEGsiASSAgICAACABQQhqEJOAgIAAIAAgASgCDDYCACABLQAIIQAgAUEQaiSAgICAACAAQQFGC0EBAX8jgICAgABBEGsiASSAgICAACABQQhqEJSAgIAAIAAgASgCDDYCACABLQAIIQAgAUEQaiSAgICAACAAQQFGCwoAIAAQlYCAgAALCAAQxIKAgAALsgIBA38jgICAgABBIGsiACSAgICAAAJAAkACQEEBQRQQv4KAgAAiAQ0AI5SAgIAAQTA2AgAMAQsgACABNgIYIAAjgYCAgABB/OHCgABqNgIcIAAgACkCGDcDEEF/IQEgAEEQahCIgoCAAEEASA0BAkBBAUEUEL+CgIAAIgINACOUgICAAEEwNgIA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AgBB////AHFJGyIDIANBB2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAmoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQbULIQQCQAJAIANBNEsNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQbjTwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuJAQECf0EAIQECQAJAAkACQAJAIABBCHYiAkFqag4bAAQEBAQEBAQEBAMEBAQEBAQEBAQEBAQEBAQBAgsgAEGALUYhAQwDCyAAQYDgAEYhAQwCCyACDQEjg4CAgAAgAEH/AXFqLQAAIQEMAQsjg4CAgAAgAEH/AXFqLQAAQQJxQQF2IQELIAFBAXEL7AIBBX9BACEBI4GAgIAAQajwwYAAaiICIAJBAEEQIABBq50ESRsiAyADQQhyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQRyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkH/BSEEAkACQCADQR9LDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEHt3sGAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELrwIBBX9BACEBI4GAgIAAQdjywYAAaiICIAJBAEEGIABBgPwDSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRq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OiDAAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvaW8vZXJyb3IvdW5peC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pbmRleC5ycwAvcnVzdC9kZXBzL2hhc2hicm93bi0wLjE3LjEvc3JjL3Jhdy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc2hhcmVkL3NtYWxsc29ydC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3N0YWJsZS9xdWlja3NvcnQucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL3F1YWRyYW50LnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvYWxsb2Mvc3JjL2ZtdC5ycwAvbW50L3dvcmsvcnVubmVyLXNoYXJlZC9jYXJnby1ob21lL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9wZXN0LTIuOS42L3NyYy9pdGVyYXRvcnMvcGFpcnMucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL3R5cGVzLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9tdXRleC9ub190aHJlYWRzLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9yd2xvY2svbm9fdGhyZWFkcy5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9hbGxvYy9zcmMvc3RyLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2Vycm9yLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL2l0ZXJhdG9ycy9wYWlyLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbWVtY2hyLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvbnVtL2ltcC9kZWMyZmx0L2RlY2ltYWxfc2VxLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL3N0ci9wYXR0ZXJuLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc3RyL3BhdHRlcm4ucnMAL21udC93b3JrL3J1bm5lci1zaGFyZWQvY2FyZ28taG9tZS9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcGVzdC0yLjkuNi9zcmMvcG9zaXRpb24ucnMAcGFja2FnZXMvd2FzbS9tZXJtYWlkL3NyYy9tZXJtYWlkL2NsYXNzX2RpYWdyYW0ucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9pby93cml0ZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9tbnQvd29yay9ydW5uZXItc2hhcmVkL2NhcmdvLWhvbWUvcmVnaXN0cnkvc3JjL2luZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmL3Blc3QtMi45LjYvc3JjL3BhcnNlcl9zdGF0ZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL251bS9pbXAvZGVjMmZsdC9wYXJzZS5ycwBwYWNrYWdlcy93YXNtL21lcm1haWQvc3JjL21lcm1haWQvcGllLnJzAHBhY2thZ2VzL3dhc20vbWVybWFpZC9zcmMvbWVybWFpZC9zZXF1ZW5jZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc3RyL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2lkLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UvcmVwcl9pb3ZlYy5ycwDAAToALwARc3RhcnQgYnl0ZSBpbmRleCDAJiBpcyBub3QgYSBjaGFyIGJvdW5kYXJ5OyBpdCBpcyBpbnNpZGUgwAggKGJ5dGVzIMALIG9mIHN0cmluZykAD2VuZCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAJcXVhZHJhbnQtwAEgABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDARyBieXRlcyBmYWlsZWQKc2tpcHBpbmcgYmFja3RyYWNlIHByaW50aW5nIHRvIGF2b2lkIHBvdGVudGlhbCByZWN1cnNpb24KADVmYXRhbCBydW50aW1lIGVycm9yOiBmYWlsZWQgdG8gaW5pdGlhdGUgcGFuaWMsIGVycm9yIMALLCBhYm9ydGluZwoAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMAOIGJ5dGVzIGZhaWxlZAoADHBhbmlja2VkIGF0IMACOgrAMwp0aHJlYWQgcGFuaWNrZWQgd2hpbGUgcHJvY2Vzc2luZyBwYW5pYy4gYWJvcnRpbmcuCgAJCnRocmVhZCAnwAMnICjADikgcGFuaWNrZWQgYXQgwAI6CsABCgAZYWJvcnRpbmcgZHVlIHRvIHBhbmljIGF0IMACOgrAAQoAdW5rbm93biBwYXJzaW5nIGVycm9yaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZWZhdGFsIHJ1bnRpbWUgZXJyb3I6IEF0dGVtcHRlZCB0byBpbml0aWFsaXplIHRocmVhZC1sb2NhbCB3aGlsZSBpdCBpcyBiZWluZyBkcm9wcGVkLCBhYm9ydGluZwoA//////////9hdHRlbXB0IHRvIGpvaW4gaW50byBjb2xsZWN0aW9uIHdpdGggbGVuID4gdXNpemU6Ok1BWGNhbGwgbGltaXQgcmVhY2hlZHN0YWNrIGxpbWl0IHJlYWNoZWRUREJUTFJSTHJlY3Ryb3VuZGVkZGlhbW9uZGNpcmNsZWlkbGFiZWxzaGFwZWFycm93bGluZXNvdXJjZXRhcmdldGVkZ2VUeXBla2luZHZhcmlhbnRkaXJlY3Rpb25ub2Rlc2VkZ2VzdGl0bGV4QXhpc0xlZnR4QXhpc1JpZ2h0eUF4aXNCb3R0b215QXhpc1RvcHF1YWRyYW50c3BvaW50c3BhcnRpY2lwYW50c21lc3NhZ2VzZnJvbXRvdGV4dGFycm93S2luZHNvbGlkZG90dGVkc29saWQtb3BlbmRvdHRlZC1vcGVuc2xpY2VzdmFsdWVzZWN0aW9uc25hbWV0YXNrc2RlcHNkdXJhdGlvbnZpc2liaWxpdHl0eXBlSW5mb2lzTWV0aG9kYXR0cmlidXRlc21ldGhvZHNyZWxUeXBlYXJyb3dBdGNsYXNzZXNyZWxhdGlvbnNoaXBzeHlBbnlEaWFncmFtR3JhcGhncmFwaFBpZXBpZUdhbnR0Z2FudHRTZXF1ZW5jZXNlcXVlbmNlQ2xhc3NjbGFzc1F1YWRyYW50cXVhZHJhbnRmYWxzZS0tPmZsb3djaGFydG1pZCA+IGxlbnBvc2l0aW9uIG91dCBvZiBib3VuZHPABC0tPiDAwAE6wAEKyAAAAyB8CtsgAABoBAACAAMgfCDIBQABCtMgAABoBAADIHwgwAEKyAAAAyB8IMgIAAEKyAAAAyB8CsgAAAMgPSDICQAARm9ybWF0dGluZyBhcmd1bWVudCBvdXQgb2YgcmFuZ2XABC0tPiDAwAE6wAEKyAAAAyB8CtsgAABoBAACAAMgfCDIBQABCsgAAAcgfCAuLi4K2yAAAGgEAAYAAyB8IMABCsgAAAMgfCDICAABCsgAAAMgfArIAAADID0gyAkAAMAELS0+IMDAATrAAQrIAAADIHwKyAIAAyB8IMgEAAEKyAAAAyB8IMgFAAEKyAAAAyB8CsgAAAMgPSDIBgAAcHVibGljcHJpdmF0ZXByb3RlY3RlZGludGVybmFsPHwtLWluaGVyaXRhbmNlKi0tY29tcG9zaXRpb25vLS1hZ2dyZWdhdGlvbi4ufD5pbXBsZW1lbnRzLi4+ZGVwZW5kZW5jeS4ubm9uZTwtLWRpcmVjdGVkLWFzc29jaWF0aW9uLS1hc3NvY2lhdGlvbi0tPj4tPj4tPkVPSWZpbGVkaWFncmFta3dzdG10c3N0bXRzdG10X2lubmVyY29tbWVudGNoYWlubm9kZWRlZm5yZWZuaWRjaXJjcm5kZGlhbXN0eHRlZGdlYXJyX2xibGFycmxuX2xibGxubGJsbHR4dHNwbmxmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyAAADBAcCCQUECgcFBwQDBQQEAwQEBAcDBgIDBAICdXV1dXV1dXVidG51ZnJ1dXV1dXV1dXV1dXV1dXV1dXUAACIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAxMjM0NTY3ODlhYmNkZWYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBQYEBQYDBAUGBAUGBAUGAwQFBgQFBgQFBgMEBQYEBWUtMzI0AAUAZS0zMjMABQBlLTMyMgAFAGUtMzIxAAUAZS0zMjAABQBlLTMxOQAFAGUtMzE4AAUAZS0zMTcABQBlLTMxNgAFAGUtMzE1AAUAZS0zMTQABQBlLTMxMwAFAGUtMzEyAAUAZS0zMTEABQBlLTMxMAAFAGUtMzA5AAUAZS0zMDgABQBlLTMwNwAFAGUtMzA2AAUAZS0zMDUABQBlLTMwNAAFAGUtMzAzAAUAZS0zMDIABQBlLTMwMQAFAGUtMzAwAAUAZS0yOTkABQBlLTI5OAAFAGUtMjk3AAUAZS0yOTYABQBlLTI5NQAFAGUtMjk0AAUAZS0yOTMABQBlLTI5MgAFAGUtMjkxAAUAZS0yOTAABQBlLTI4OQAFAGUtMjg4AAUAZS0yODcABQBlLTI4NgAFAGUtMjg1AAUAZS0yODQABQBlLTI4MwAFAGUtMjgyAAUAZS0yODEABQBlLTI4MAAFAGUtMjc5AAUAZS0yNzgABQBlLTI3NwAFAGUtMjc2AAUAZS0yNzUABQBlLTI3NAAFAGUtMjczAAUAZS0yNzIABQBlLTI3MQAFAGUtMjcwAAUAZS0yNjkABQBlLTI2OAAFAGUtMjY3AAUAZS0yNjYABQBlLTI2NQAFAGUtMjY0AAUAZS0yNjMABQBlLTI2MgAFAGUtMjYxAAUAZS0yNjAABQBlLTI1OQAFAGUtMjU4AAUAZS0yNTcABQBlLTI1NgAFAGUtMjU1AAUAZS0yNTQABQBlLTI1MwAFAGUtMjUyAAUAZS0yNTEABQBlLTI1MAAFAGUtMjQ5AAUAZS0yNDgABQBlLTI0NwAFAGUtMjQ2AAUAZS0yNDUABQBlLTI0NAAFAGUtMjQzAAUAZS0yNDIABQBlLTI0MQAFAGUtMjQwAAUAZS0yMzkABQBlLTIzOAAFAGUtMjM3AAUAZS0yMzYABQBlLTIzNQAFAGUtMjM0AAUAZS0yMzMABQBlLTIzMgAFAGUtMjMxAAUAZS0yMzAABQBlLTIyOQAFAGUtMjI4AAUAZS0yMjcABQBlLTIyNgAFAGUtMjI1AAUAZS0yMjQABQBlLTIyMwAFAGUtMjIyAAUAZS0yMjEABQBlLTIyMAAFAGUtMjE5AAUAZS0yMTgABQBlLTIxNwAFAGUtMjE2AAUAZS0yMTUABQBlLTIxNAAFAGUtMjEzAAUAZS0yMTIABQBlLTIxMQAFAGUtMjEwAAUAZS0yMDkABQBlLTIwOAAFAGUtMjA3AAUAZS0yMDYABQBlLTIwNQAFAGUtMjA0AAUAZS0yMDMABQBlLTIwMgAFAGUtMjAxAAUAZS0yMDAABQBlLTE5OQAFAGUtMTk4AAUAZS0xOTcABQBlLTE5NgAFAGUtMTk1AAUAZS0xOTQABQBlLTE5MwAFAGUtMTkyAAUAZS0xOTEABQBlLTE5MAAFAGUtMTg5AAUAZS0xODgABQBlLTE4NwAFAGUtMTg2AAUAZS0xODUABQBlLTE4NAAFAGUtMTgzAAUAZS0xODIABQBlLTE4MQAFAGUtMTgwAAUAZS0xNzkABQBlLTE3OAAFAGUtMTc3AAUAZS0xNzYABQBlLTE3NQAFAGUtMTc0AAUAZS0xNzMABQBlLTE3MgAFAGUtMTcxAAUAZS0xNzAABQBlLTE2OQAFAGUtMTY4AAUAZS0xNjcABQBlLTE2NgAFAGUtMTY1AAUAZS0xNjQABQBlLTE2MwAFAGUtMTYyAAUAZS0xNjEABQBlLTE2MAAFAGUtMTU5AAUAZS0xNTgABQBlLTE1NwAFAGUtMTU2AAUAZS0xNTUABQBlLTE1NAAFAGUtMTUzAAUAZS0xNTIABQBlLTE1MQAFAGUtMTUwAAUAZS0xNDkABQBlLTE0OAAFAGUtMTQ3AAUAZS0xNDYABQBlLTE0NQAFAGUtMTQ0AAUAZS0xNDMABQBlLTE0MgAFAGUtMTQxAAUAZS0xNDAABQBlLTEzOQAFAGUtMTM4AAUAZS0xMzcABQBlLTEzNgAFAGUtMTM1AAUAZS0xMzQABQBlLTEzMwAFAGUtMTMyAAUAZS0xMzEABQBlLTEzMAAFAGUtMTI5AAUAZS0xMjgABQBlLTEyNwAFAGUtMTI2AAUAZS0xMjUABQBlLTEyNAAFAGUtMTIzAAUAZS0xMjIABQBlLTEyMQAFAGUtMTIwAAUAZS0xMTkABQBlLTExOAAFAGUtMTE3AAUAZS0xMTYABQBlLTExNQAFAGUtMTE0AAUAZS0xMTMABQBlLTExMgAFAGUtMTExAAUAZS0xMTAABQBlLTEwOQAFAGUtMTA4AAUAZS0xMDcABQBlLTEwNgAFAGUtMTA1AAUAZS0xMDQABQBlLTEwMwAFAGUtMTAyAAUAZS0xMDEABQBlLTEwMAAFAGUtOTkAAAQAZS05OAAABABlLTk3AAAEAGUtOTYAAAQAZS05NQAABABlLTk0AAAEAGUtOTMAAAQAZS05MgAABABlLTkxAAAEAGUtOTAAAAQAZS04OQAABABlLTg4AAAEAGUtODcAAAQAZS04NgAABABlLTg1AAAEAGUtODQAAAQAZS04MwAABABlLTgyAAAEAGUtODEAAAQAZS04MAAABABlLTc5AAAEAGUtNzgAAAQAZS03NwAABABlLTc2AAAEAGUtNzUAAAQAZS03NAAABABlLTczAAAEAGUtNzIAAAQAZS03MQAABABlLTcwAAAEAGUtNjkAAAQAZS02OAAABABlLTY3AAAEAGUtNjYAAAQAZS02NQAABABlLTY0AAAEAGUtNjMAAAQAZS02MgAABABlLTYxAAAEAGUtNjAAAAQAZS01OQAABABlLTU4AAAEAGUtNTcAAAQAZS01NgAABABlLTU1AAAEAGUtNTQAAAQAZS01MwAABABlLTUyAAAEAGUtNTEAAAQAZS01MAAABABlLTQ5AAAEAGUtNDgAAAQAZS00NwAABABlLTQ2AAAEAGUtNDUAAAQAZS00NAAABABlLTQzAAAEAGUtNDIAAAQAZS00MQAABABlLTQwAAAEAGUtMzkAAAQAZS0zOAAABABlLTM3AAAEAGUtMzYAAAQAZS0zNQAABABlLTM0AAAEAGUtMzMAAAQAZS0zMgAABABlLTMxAAAEAGUtMzAAAAQAZS0yOQAABABlLTI4AAAEAGUtMjcAAAQAZS0yNgAABABlLTI1AAAEAGUtMjQAAAQAZS0yMwAABABlLTIyAAAEAGUtMjEAAAQAZS0yMAAABABlLTE5AAAEAGUtMTgAAAQAZS0xNwAABABlLTE2AAAEAGUtMTUAAAQAZS0xNAAABABlLTEzAAAEAGUtMTIAAAQAZS0xMQAABABlLTEwAAAEAGUtOQAAAAMAZS04AAAAAwBlLTcAAAADAGUtNgAAAAMAZS01AAAAAwBlLTQAAAADAGUtMwAAAAMAZS0yAAAAAwBlLTEAAAADAGUrMAAAAAMAZSsxAAAAAwBlKzIAAAADAGUrMwAAAAMAZSs0AAAAAwBlKzUAAAADAGUrNgAAAAMAZSs3AAAAAwBlKzgAAAADAGUrOQAAAAMAZSsxMAAABABlKzExAAAEAGUrMTIAAAQAZSsxMwAABABlKzE0AAAEAGUrMTUAAAQAZSsxNgAABABlKzE3AAAEAGUrMTgAAAQAZSsxOQAABABlKzIwAAAEAGUrMjEAAAQAZSsyMgAABABlKzIzAAAEAGUrMjQAAAQAZSsyNQAABABlKzI2AAAEAGUrMjcAAAQAZSsyOAAABABlKzI5AAAEAGUrMzAAAAQAZSszMQAABABlKzMyAAAEAGUrMzMAAAQAZSszNAAABABlKzM1AAAEAGUrMzYAAAQAZSszNwAABABlKzM4AAAEAGUrMzkAAAQAZSs0MAAABABlKzQxAAAEAGUrNDIAAAQAZSs0MwAABABlKzQ0AAAEAGUrNDUAAAQAZSs0NgAABABlKzQ3AAAEAGUrNDgAAAQAZSs0OQAABABlKzUwAAAEAGUrNTEAAAQAZSs1MgAABABlKzUzAAAEAGUrNTQAAAQAZSs1NQAABABlKzU2AAAEAGUrNTcAAAQAZSs1OAAABABlKzU5AAAEAGUrNjAAAAQAZSs2MQAABABlKzYyAAAEAGUrNjMAAAQAZSs2NAAABABlKzY1AAAEAGUrNjYAAAQAZSs2NwAABABlKzY4AAAEAGUrNjkAAAQAZSs3MAAABABlKzcxAAAEAGUrNzIAAAQAZSs3MwAABABlKzc0AAAEAGUrNzUAAAQAZSs3NgAABABlKzc3AAAEAGUrNzgAAAQAZSs3OQAABABlKzgwAAAEAGUrODEAAAQAZSs4MgAABABlKzgzAAAEAGUrODQAAAQAZSs4NQAABABlKzg2AAAEAGUrODcAAAQAZSs4OAAABABlKzg5AAAEAGUrOTAAAAQAZSs5MQAABABlKzkyAAAEAGUrOTMAAAQAZSs5NAAABABlKzk1AAAEAGUrOTYAAAQAZSs5NwAABABlKzk4AAAEAGUrOTkAAAQAZSsxMDAABQBlKzEwMQAFAGUrMTAyAAUAZSsxMDMABQBlKzEwNAAFAGUrMTA1AAUAZSsxMDYABQBlKzEwNwAFAGUrMTA4AAUAZSsxMDkABQBlKzExMAAFAGUrMTExAAUAZSsxMTIABQBlKzExMwAFAGUrMTE0AAUAZSsxMTUABQBlKzExNgAFAGUrMTE3AAUAZSsxMTgABQBlKzExOQAFAGUrMTIwAAUAZSsxMjEABQBlKzEyMgAFAGUrMTIzAAUAZSsxMjQABQBlKzEyNQAFAGUrMTI2AAUAZSsxMjcABQBlKzEyOAAFAGUrMTI5AAUAZSsxMzAABQBlKzEzMQAFAGUrMTMyAAUAZSsxMzMABQBlKzEzNAAFAGUrMTM1AAUAZSsxMzYABQBlKzEzNwAFAGUrMTM4AAUAZSsxMzkABQBlKzE0MAAFAGUrMTQxAAUAZSsxNDIABQBlKzE0MwAFAGUrMTQ0AAUAZSsxNDUABQBlKzE0NgAFAGUrMTQ3AAUAZSsxNDgABQBlKzE0OQAFAGUrMTUwAAUAZSsxNTEABQBlKzE1MgAFAGUrMTUzAAUAZSsxNTQABQBlKzE1NQAFAGUrMTU2AAUAZSsxNTcABQBlKzE1OAAFAGUrMTU5AAUAZSsxNjAABQBlKzE2MQAFAGUrMTYyAAUAZSsxNjMABQBlKzE2NAAFAGUrMTY1AAUAZSsxNjYABQBlKzE2NwAFAGUrMTY4AAUAZSsxNjkABQBlKzE3MAAFAGUrMTcxAAUAZSsxNzIABQBlKzE3MwAFAGUrMTc0AAUAZSsxNzUABQBlKzE3NgAFAGUrMTc3AAUAZSsxNzgABQBlKzE3OQAFAGUrMTgwAAUAZSsxODEABQBlKzE4MgAFAGUrMTgzAAUAZSsxODQABQBlKzE4NQAFAGUrMTg2AAUAZSsxODcABQBlKzE4OAAFAGUrMTg5AAUAZSsxOTAABQBlKzE5MQAFAGUrMTkyAAUAZSsxOTMABQBlKzE5NAAFAGUrMTk1AAUAZSsxOTYABQBlKzE5NwAFAGUrMTk4AAUAZSsxOTkABQBlKzIwMAAFAGUrMjAxAAUAZSsyMDIABQBlKzIwMwAFAGUrMjA0AAUAZSsyMDUABQBlKzIwNgAFAGUrMjA3AAUAZSsyMDgABQBlKzIwOQAFAGUrMjEwAAUAZSsyMTEABQBlKzIxMgAFAGUrMjEzAAUAZSsyMTQABQBlKzIxNQAFAGUrMjE2AAUAZSsyMTcABQBlKzIxOAAFAGUrMjE5AAUAZSsyMjAABQBlKzIyMQAFAGUrMjIyAAUAZSsyMjMABQBlKzIyNAAFAGUrMjI1AAUAZSsyMjYABQBlKzIyNwAFAGUrMjI4AAUAZSsyMjkABQBlKzIzMAAFAGUrMjMxAAUAZSsyMzIABQBlKzIzMwAFAGUrMjM0AAUAZSsyMzUABQBlKzIzNgAFAGUrMjM3AAUAZSsyMzgABQBlKzIzOQAFAGUrMjQwAAUAZSsyNDEABQBlKzI0MgAFAGUrMjQzAAUAZSsyNDQABQBlKzI0NQAFAGUrMjQ2AAUAZSsyNDcABQBlKzI0OAAFAGUrMjQ5AAUAZSsyNTAABQBlKzI1MQAFAGUrMjUyAAUAZSsyNTMABQBlKzI1NAAFAGUrMjU1AAUAZSsyNTYABQBlKzI1NwAFAGUrMjU4AAUAZSsyNTkABQBlKzI2MAAFAGUrMjYxAAUAZSsyNjIABQBlKzI2MwAFAGUrMjY0AAUAZSsyNjUABQBlKzI2NgAFAGUrMjY3AAUAZSsyNjgABQBlKzI2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bmljLiBhYm9ydGluZy4Kc3RhY2sgYmFja3RyYWNlOgpub3RlOiBTb21lIGRldGFpbHMgYXJlIG9taXR0ZWQsIHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT1mdWxsYCBmb3IgYSB2ZXJib3NlIGJhY2t0cmFjZS4KZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcnN0cmVycm9yX3IgZmFpbHVyZWZhaWxlZCB0byBnZW5lcmF0ZSB1bmlxdWUgdGhyZWFkIElEOiBiaXRzcGFjZSBleGhhdXN0ZWRyd2xvY2sgaGFzIG5vdCBiZWVuIGxvY2tlZCBmb3IgcmVhZGluZyIBCAkrDSsrKxwrKwYCAx4rKxoMKxsEKysnIxQpKw8SKCArKyEKKwUoKysAKysrJisrGCQHDhArKyQrKysrAQsrKysrERkrExYdH0hhc2ggdGFibGUgY2FwYWNpdHkgb3ZlcmZsb3dTdWNjZXNzAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAE5vIHN1Y2ggZGV2aWNlAE5vdCBhIGRpcmVjdG9yeQBJcyBhIGRpcmVjdG9yeQBUZXh0IGZpbGUgYnVzeQBFeGVjIGZvcm1hdCBlcnJvcgBJbnZhbGlkIGFyZ3VtZW50AEFyZ3VtZW50IGxpc3QgdG9vIGxvbmcAU3ltYm9saWMgbGluayBsb29wAEZpbGVuYW1lIHRvbyBsb25nAFRvbyBtYW55IG9wZW4gZmlsZXMgaW4gc3lzdGVtAE5vIGZpbGUgZGVzY3JpcHRvcnMgYXZhaWxhYmxlAEJhZCBmaWxlIGRlc2NyaXB0b3IATm8gY2hpbGQgcHJvY2VzcwBCYWQgYWRkcmVzcwBGaWxlIHRvbyBsYXJnZQBUb28gbWFueSBsaW5rcwBObyBsb2NrcyBhdmFpbGFibGUAUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIAU3RhdGUgbm90IHJlY292ZXJhYmxlAFByZXZpb3VzIG93bmVyIGRpZWQAT3BlcmF0aW9uIGNhbmNlbGVkAEZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZABObyBtZXNzYWdlIG9mIGRlc2lyZWQgdHlwZQBJZGVudGlmaWVyIHJlbW92ZWQATGluayBoYXMgYmVlbiBzZXZlcmVkAFByb3RvY29sIGVycm9yAEJhZCBtZXNzYWdlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUXVvdGEgZXhjZWVkZWQATXVsdGlob3AgYXR0ZW1wdGVkAENhcGFiaWxpdGllcyBpbnN1ZmZpY2llbnQAAAAAAAAAAAAAAAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gXvv71jYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90RXJyb3KqAQoBBAEFFwEfAQAEDA4FBwEBAVYBHRIBAgIEAQEGAQEDAQEBFAFTAYsIpgEmAgEGKScOAQEBAgECAQEIGwQEHQsFOAEHDmYBCAQIBAMKAwIBEDANZRghCQIEAQUYAhMTGQcLBRgBBwcBCCoKDAMHBkwBEAEDBA8NEwEIAgICFgEHAQEDBAMIAgICAgEBCAEEAgEFDAIKAQQDAQYEAgIWAQcBAgECAQIEBQQCAgIEAQcEAQERBgsDAQkBAwEWAQcBAgEFAwkBAwECAwEPBBUEBAMBCAICAhYBBwECAQUDCAICAgIJAgQCAQUNARACAQYDAwEEAwIBAQECAwIDAwMMBAUDAwEDAwEGASgNAQMBFwEQAwgBAwEDCAIBAwECAgQcBAEIAQMBFwEKAQUDCAEDAQMIAgUDAQQNAwwNAQMBKQIIAQMBAwEBBQQHBRYGAQMBEgMYAQkBAQIHCAYBAQEIEgINOgUHBgEzAgEBAQUBGAEBARMBAwIFAQEGAQ4EIAE/CAEkBBMEEAEkQzcBAQIFEEAKBAImAQEFAQIrAQABBAIHAQEBBAIpAQQCIQEEAgcBAQEEAg8BOQEEAkMlEBBWAgYDAAIRARoFSwMLBxQLFQwUDA0BAwECDDQCEw4BBAFDWQcrBUYKHwEMBAkXHgIFCywEGjYcBD8CFDIBFwIL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DAQKB5MBZwAAIAACAAIADwAAAAAABQAAAABwAAcALQEBAQIBAgEBSAswFRABZQcCBgICAQQjAR4bWws6CQkBGAQBCQEDAQUrAzsJKhgBIDcBAQEECAQBAwcKAh0BOgEBAQIECAEJAQoCGgECAjkBBAIEAgIDAwEeAgMBCwI5AQQFAQIEARQCFgYBAToBAQIBBAgBBwMKAh4BOwEBAQwBCQEoAQMBNwEBAwUDAQQHAgsCHQE6AQICAQEDAwEEBwILAhwCOQIBAQIECAEJAQoCHQFIAQQBAgMBAQgBUQECBwwIYgECCQsHSQIbAQEBAQE3DgEFAQIFCwEkCQFmBAEGAQICAhkCBAMQBA0BAgIGAQ8BAAMABBwDHQIeAkACAQcIAQILCQEtAwEBdQIiAXYDBAIJAQYD2wICAToBAQcBAQEBAggGCgIBMC4CDBQEMAoEAyYJDAIgBAIGOAEBAgMBAQU4CAICmAMBDQEHBAEGAQMCxkAAAcMhAAONAWAgAAZpAgAEAQogAlACAAEDAQQBGQIFAZcCGhINASYIGQsBASwDMAECBAICAgEkAUMGAgICAgwBCAEvATMBAQMCAgUCAQEqAggB7gECAQQBAAEAEBAQAAIAAeIBlQUAAwECBQQoAwQBpQIABEEFAAJNBkYLMQR7ATYPKQECAgoDMQQCAgcBPQMkBQEIPgEMAjQJAQEIBAIBXwMCBAYBAgGdAQMIFQI5AgEBAQEMAQkBDgcDBUMBAgYBAQIBAQMEAwEBDgJVCAIDAQEXAVEBAgYBAQIBAQIBAusBAgQGAgECGwJVCAIBAQJqAQEBAghlAQEBAgQBBQAJAQL1AQoEBAGQBAICBAEgCigGAgQIAQkGAgMuDQECxgEBAwEByQcBBgEBUhYCBwECAQJ6BgMBAQIBBwEBSAIDAQEBAAILAjQFBQMXAQABBg8ADAMDAAU7BwABPwRRAQsCAAIALgIXAAUDBggIAgceBJQDADcEMggBDgEWBQEPAAcBEQIHAQIBBWQBoAcAAT0EAAT+AvMBAgEHAgUBAAdtBwBggPAAsgIFAQIDAAqGCsYKAAp2CgQGbAp2CnYKAgZuDXMKCAdnCmgHBxNtCmAKdgpGFAAKRgoAFAAD7woGChYKAAqAC6UKBgq2ClYKhgoGCgABAwYGCsYzAgUAPE4WAB4AAQABGQkOAwAEigoeCAEP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qzi7OMxA3UDvQAJJFUkpST5RU1FpUYBRmFmwWclZ42H9YRhiNGpQam1qi2qqcsly6XIKeyt7TXtwg5ODt4PcgwKMKIxPjHeUn5TIlPKcHAUcBRwFHAUFAgUBAgUGAgUDAQIFAQUGAgUHCAECBQMJAAYCBQEJBQMBAgUJBwYFBgIFBAgIAggBAgUCBAQBBAAGAgUBAgIABwADAQIFBgEAAwUBBQYCBQMABQEHBQcIAQIFAQUCBQgHCAkABgIFBwYCCQMJBAUDAQIFAwgBBAYJBwIGBQYCBQEJAAcDBAgGAwIIAQIFCQUDBgcEAwEGBAAGAgUEBwYIAwcBBQgCAAMBAgUCAwgEAQgFBwkBAAEFBgIFAQEJAgAJAggJBQUABwgBAgUFCQYABAYEBAcHBQMJAAYCBQIJCAACAwICAwgHBgkFAwECBQEECQABAQYBAQkDCAQHBgUGAgUHBAUABQgABQkGCQIDCAIIAQIFAwcCBQIJAAIJCAQGAQkBBAAGAgUBCAYCBgQFAQQJAgMACQUHAAMBAgUJAwEDAgIFBwQGAQUEBwgFAQUGAgUEBgUGBgECCAcDAAcHAwkCBQcIAQIFAgMCCAMABgQDBgUDCAYJBgIICQAGAgUBAQYEAQUDAgEIAgYJAwQIAQQEBQMBAgUFCAIABwYGAAkBAwQGBwQABwICBgUGAgUCCQEAAwgDAAQFBgcDAwcAAwYBAwIIAQIFAQQFBQEJAQUCAggDBgYIBQEIAAYGBAAGAgUHAgcFCQUHBgEEAQgDBAIFCQADAwIAAwECBQMGAwcJBwgIAAcACQEHAQIJBQEGBgABBQYCBQEIAQgJCAkEAAMFBAUIBQYEBwUIAwAABwgBAgUJAAkECQQHAAEHBwIJAggCAwcJAQUAAwkABgIFBAUEBwQHAwUACAgGBAYEAQEICQUHBQEJBQMBAgUCAgcDBwMGBwUEBAMCAwIABQkEBwgHBQkHBgUGAgUBAQMGCAYIAwcHAgEGAQYAAgkHAwkDBwkICAIIAQIFBQYIBAMEAQgIBgAIAAgAAQQIBgkGCAkJBAEEAAYCBQIIBAIBBwAJBAMABAAEAAAHBAMECAQECQcABwADAQIFAQQCAQAIBQQHAQUCAAIAAAMHAQcEAgIECAUDBQEFBgIFBwEABQQCBwMFBwYAAQAAAQgFCAcBAQIEAgYHBQcIAQIFAwUF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");
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
