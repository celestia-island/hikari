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
const __jcoEmbeddedRuntime$toUint8 = (context, value) => {
	context.strict && !__jcoEmbeddedRuntime$isUint8(value) && __jcoEmbeddedRuntime$invalidNumericPrimitive("u8", value);
	return value & 255;
};
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
const __jcoEmbeddedRuntime$initializeComponentErrorClass = () => {
	class ComponentError extends Error {
		constructor(value) {
			let enumerable = typeof value != "string";
			super(enumerable ? `${String(value)} (see error.payload)` : value);
			Object.defineProperty(this, "payload", {
				value,
				enumerable
			});
		}
	}
	return ComponentError;
};
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
const __jcoEmbeddedRuntime$throwInvalidBool = () => {
	throw TypeError("invalid variant discriminant for bool");
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
const toUint8 = __jcoEmbeddedRuntime$toUint8;
const base64Compile = __jcoEmbeddedRuntime$base64Compile;
const clampGuest = __jcoEmbeddedRuntime$clampGuest;
const _clearCurrentTask = __jcoEmbeddedRuntime$clearCurrentTaskMeta;
const _debugLog = __jcoEmbeddedRuntime$debugLog;
const _getGlobalCurrentThreadMeta = __jcoEmbeddedRuntime$getCurrentTaskMeta;
const getErrorPayload = __jcoEmbeddedRuntime$getErrorPayload;
const _jcoInitializeAsyncDeterminism = __jcoEmbeddedRuntime$initializeAsyncDeterminism;
const _jcoInitializeAsyncEventCodes = __jcoEmbeddedRuntime$initializeAsyncEventCodes;
const _jcoInitializeComponentErrorClass = __jcoEmbeddedRuntime$initializeComponentErrorClass;
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
const throwInvalidBool = __jcoEmbeddedRuntime$throwInvalidBool;
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
const ComponentError = _jcoInitializeComponentErrorClass();
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
const _trampoline15 = function(arg0, arg1, arg2) {
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
_trampoline15.fnName = "wasi:io/poll@0.2.12#poll";
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
_trampoline16.fnName = "wasi:io/streams@0.2.12#checkWrite";
const _trampoline17 = function(arg0, arg1, arg2, arg3) {
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
_trampoline17.fnName = "wasi:io/streams@0.2.12#write";
const _trampoline18 = function(arg0, arg1) {
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
_trampoline18.fnName = "wasi:io/streams@0.2.12#blockingFlush";
const _trampoline19 = function(arg0) {
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
_trampoline19.fnName = "wasi:cli/environment@0.2.12#getEnvironment";
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
const _trampoline20 = function(arg0) {
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
_trampoline20.fnName = "wasi:cli/terminal-stdin@0.2.12#getTerminalStdin";
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
const _trampoline21 = function(arg0) {
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
_trampoline21.fnName = "wasi:cli/terminal-stdout@0.2.12#getTerminalStdout";
const _trampoline22 = function(arg0) {
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
_trampoline22.fnName = "wasi:cli/terminal-stderr@0.2.12#getTerminalStderr";
const _trampoline23 = function(arg0) {
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
_trampoline23.fnName = "wasi:clocks/wall-clock@0.2.12#now$1";
let exports2;
let postReturn0;
let exports1Encode;
function encode(arg0, arg1) {
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfTrapped();
	let { task, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
		componentIdx: 0,
		isAsync: !1,
		isManualAsync: !1,
		preserveFutureResult: !1,
		entryFnName: "exports1Encode",
		getCallbackFn: () => null,
		callbackFnName: null,
		errHandling: "throw-result-err",
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
				var variant5 = arg1;
				let variant5_0;
				let variant5_1;
				let variant5_2;
				let variant5_3;
				let variant5_4;
				if (variant5 == null) {
					variant5_0 = 0;
					variant5_1 = 0;
					variant5_2 = 0;
					variant5_3 = 0;
					variant5_4 = 0;
				} else {
					var { ecc: v1_0, version: v1_1 } = variant5;
					var variant3 = v1_0;
					let variant3_0;
					let variant3_1;
					if (variant3 == null) {
						variant3_0 = 0;
						variant3_1 = 0;
					} else {
						let e = variant3;
						var val2 = e;
						let enum2;
						switch (val2) {
							case "l":
								enum2 = 0;
								break;
							case "m":
								enum2 = 1;
								break;
							case "q":
								enum2 = 2;
								break;
							case "h":
								enum2 = 3;
								break;
							default:
								e instanceof Error && console.error(e);
								throw TypeError(`"${val2}" is not one of the cases of ecc-level`);
						}
						variant3_0 = 1;
						variant3_1 = enum2;
					}
					var variant4 = v1_1;
					let variant4_0;
					let variant4_1;
					if (variant4 == null) {
						variant4_0 = 0;
						variant4_1 = 0;
					} else {
						let e = variant4;
						variant4_0 = 1;
						variant4_1 = toUint8(_jcoStrictNumericContext, e);
					}
					variant5_0 = 1;
					variant5_1 = variant3_0;
					variant5_2 = variant3_1;
					variant5_3 = variant4_0;
					variant5_4 = variant4_1;
				}
				_debugLog("[iface=\"encode\", function=\"encode\"][Instruction::CallWasm] enter", {
					funcName: "encode",
					paramCount: 7,
					async: !1,
					postReturn: !0
				});
				let ret;
				try {
					ret = _withGlobalCurrentThreadMeta(CURRENT_TASK_META, {
						taskID: task.id(),
						threadID,
						componentIdx: task.componentIdx(),
						fn: () => exports1Encode(ptr0, len0, variant5_0, variant5_1, variant5_2, variant5_3, variant5_4)
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
				let variant10;
				switch (dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 0, !0)) {
					case 0: {
						var len7 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 12, !0);
						var base7 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 8, !0) >>> 0;
						if (base7 < 0 || len7 < 0 || len7 > 268435455 || base7 > memory0.buffer.byteLength || len7 > Math.floor((memory0.buffer.byteLength - base7) / 1)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
						if (base7 % 1 != 0) throw TypeError(`list pointer [${base7}] is not aligned to 1`);
						var result7 = [];
						for (let i = 0; i < len7; i++) {
							let base = base7 + i * 1;
							var bool6 = dataView(_jcoDataViewCacheContext, memory0).getUint8(base + 0, !0);
							result7.push(bool6 == 0 ? !1 : bool6 == 1 || throwInvalidBool());
						}
						let enum8;
						switch (dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 17, !0)) {
							case 0:
								enum8 = "l";
								break;
							case 1:
								enum8 = "m";
								break;
							case 2:
								enum8 = "q";
								break;
							case 3:
								enum8 = "h";
								break;
							default: throw TypeError("invalid discriminant specified for EccLevel");
						}
						variant10 = {
							tag: "ok",
							val: {
								size: clampGuest(dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 4, !0), 0, 255),
								modules: result7,
								version: clampGuest(dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 16, !0), 0, 255),
								ecc: enum8
							}
						};
						break;
					}
					case 1:
						var ptr9 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 4, !0) >>> 0;
						var len9 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 8, !0) >>> 0;
						if (ptr9 > memory0.buffer.byteLength || len9 > Math.floor((memory0.buffer.byteLength - ptr9) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
						variant10 = {
							tag: "err",
							val: _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr9, len9))
						};
						break;
					default: throw TypeError("invalid variant discriminant for expected");
				}
				_debugLog("[iface=\"encode\", function=\"encode\"][Instruction::Return]", {
					funcName: "encode",
					paramCount: 1,
					async: !1,
					postReturn: !0
				});
				let retCopy = variant10;
				task.resolve([retCopy]);
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
				if (typeof retCopy == "object" && retCopy.tag === "err") throw new ComponentError(retCopy.val);
				return retCopy.val;
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
	importFn: _trampoline16
});
let trampoline17 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 17,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline17.manuallyAsync,
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
	importFn: _trampoline17
});
let trampoline18 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 18,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline18.manuallyAsync,
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
	importFn: _trampoline18
});
let trampoline19 = _lowerImportBackwardsCompat.bind(null, _jcoTaskCompatImportContext, {
	trampolineIdx: 19,
	componentIdx: 0,
	isAsync: !1,
	isManualAsync: _trampoline19.manuallyAsync,
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
	importFn: _trampoline23
});
await (() => {
	let gen = (function* _initGenerator() {
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABgQETYAJ/fwF/YAF/AGACf38AYAR/f39/AGADf39/AX9gAX8Bf2AGf39/f39/AX9gA39/fwBgAAF/YAABfmABfgF/YAAAYAd/f39/f39/AX9gBH9/f38Bf2AFf39/f38AYAZ/f39/f38AYAJ/fgF/YAV/f39/fwF/YAh/f39/f39/fwAC9AgYFHdhc2k6aW8vZXJyb3JAMC4yLjEyFFtyZXNvdXJjZS1kcm9wXWVycm9yAAETd2FzaTppby9wb2xsQDAuMi4xMhdbcmVzb3VyY2UtZHJvcF1wb2xsYWJsZQABFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAEWd2FzaTppby9zdHJlYW1zQDAuMi4xMhxbcmVzb3VyY2UtZHJvcF1vdXRwdXQtc3RyZWFtAAEed2FzaTpjbGkvdGVybWluYWwtaW5wdXRAMC4yLjEyHVtyZXNvdXJjZS1kcm9wXXRlcm1pbmFsLWlucHV0AAEfd2FzaTpjbGkvdGVybWluYWwtb3V0cHV0QDAuMi4xMh5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQAARt3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMTIPZ2V0LWVudmlyb25tZW50AAEUd2FzaTpjbGkvZXhpdEAwLjIuMTIEZXhpdAABFHdhc2k6Y2xpL2V4aXRAMC4yLjEyDmV4aXQtd2l0aC1jb2RlAAETd2FzaTppby9wb2xsQDAuMi4xMhZbbWV0aG9kXXBvbGxhYmxlLmJsb2NrAAETd2FzaTppby9wb2xsQDAuMi4xMgRwb2xsAAcWd2FzaTppby9zdHJlYW1zQDAuMi4xMiFbbWV0aG9kXW91dHB1dC1zdHJlYW0uY2hlY2std3JpdGUAAhZ3YXNpOmlvL3N0cmVhbXNAMC4yLjEyG1ttZXRob2Rdb3V0cHV0LXN0cmVhbS53cml0ZQADFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIkW21ldGhvZF1vdXRwdXQtc3RyZWFtLmJsb2NraW5nLWZsdXNoAAIWd2FzaTppby9zdHJlYW1zQDAuMi4xMh9bbWV0aG9kXW91dHB1dC1zdHJlYW0uc3Vic2NyaWJlAAUVd2FzaTpjbGkvc3RkaW5AMC4yLjEyCWdldC1zdGRpbgAIFndhc2k6Y2xpL3N0ZG91dEAwLjIuMTIKZ2V0LXN0ZG91dAAIFndhc2k6Y2xpL3N0ZGVyckAwLjIuMTIKZ2V0LXN0ZGVycgAIHndhc2k6Y2xpL3Rlcm1pbmFsLXN0ZGluQDAuMi4xMhJnZXQtdGVybWluYWwtc3RkaW4AAR93YXNpOmNsaS90ZXJtaW5hbC1zdGRvdXRAMC4yLjEyE2dldC10ZXJtaW5hbC1zdGRvdXQAAR93YXNpOmNsaS90ZXJtaW5hbC1zdGRlcnJAMC4yLjEyE2dldC10ZXJtaW5hbC1zdGRlcnIAASJ3YXNpOmNsb2Nrcy9tb25vdG9uaWMtY2xvY2tAMC4yLjEyA25vdwAJIndhc2k6Y2xvY2tzL21vbm90b25pYy1jbG9ja0AwLjIuMTISc3Vic2NyaWJlLWR1cmF0aW9uAAodd2FzaTpjbG9ja3Mvd2FsbC1jbG9ja0AwLjIuMTIDbm93AAEDogKgAgsLAQcDCwcBDAAHDQsODg8CAAAAAAAABw8BAgcEBwQHAwICAAQCAwMCDQAAAAAAAAAAAAAHCw8LAQEBAQEBDw4BAQEBBwEBDgIAAAILBwgDCwMBAgALBw0BAgIACAsFAgcFAQcDAQgLBwIDBQAABQUBAgIEBAQDAAICAgAAAwUCAwMFAwIDAwAEAgIDAgAEAAQABAQNAAsEAAQBCwsLAAUFAAEQBAEBAQUBAQUBBQEBAQEBAQIEBAAFCAgIBQUFCQoBCwgBAAAABQUFBQsAAQUAABEHBQUABQAAAAUAAAUEBQQRBAUFBQQBAQAAAgQACwEHAgMCAQILBwcAAAQHBBIAAA0HAwcHBgARBAQAAQAHDgAAAwEIAQIEAQAABAAFBQQFAXABW1sFAwEAEQa3ARt/AUGAgMAAC38AQQALfwBBAQt/AEEBC38AQZSCwQALfwBBEAt/AEGcgsEAC38AQcCCwQALfwBBFAt/AEEVC38AQRULfwBBuILBAAt/AEEXC38AQcCBwQALfwBB1ILBAAt/AEG8gsEAC38AQRkLfwBB7N3AAAt/AEHw3cAAC38AQYSAwQALfwBBgIDAAAt/AEEAC38AQaCLwQALfwBBoJDBAAt/AEGAgMQAC38AQdQAC38AQdcACwdEBQZtZW1vcnkCAAtfaW5pdGlhbGl6ZQAZEGNhYmlfcG9zdF9lbmNvZGUAHwZlbmNvZGUAIAxjYWJpX3JlYWxsb2MArAEJoQEBAEEBC1pKHUsuLC0rQkVEQ0ZHSUhjYWKEAZgCpAJpc12zAqwBkwFSiwGlAaYBjAGnAagBjQGpAaoBU6ABnwGrAZQBkgGQAZEBVY8BogGhAaQBhQGHAYYBmAGVAZYBlwGCAY4BUZ0BmQGaAZwBngGbAaMBiAGKAYkBrgHcAd0B3gHfAeAB4QHmAYgClAKTApYCkgKqAqkCmQKmArUCtwK2AgqKoASgAgIACzEAAkAjgYCAgABB8IHBgABqKAIARQ0AAAsjgYCAgABB8IHBgABqQQE2AgAQmICAgAALTwEBfyOAgICAAEEQayIBJICAgIAAIAFBCGogACAAKAIAEJuAgIAAAkAgASgCCCIAQX9GDQAgACABKAIMEIqCgIAAAAsgAUEQaiSAgICAAAucAQECfyOAgICAAEEQayIDJICAgIAAIANBBGogASgCACIEIAEoAgQgBEEBdCIEIAJBAWoiAiAEIAJLGyICQQggAkEISxsiAhCcgICAAAJAAkAgAygCBEUNACADKAIMIQEgAygCCCECDAELIAMoAgghBCABIAI2AgAgASAENgIEQX8hAgsgACABNgIEIAAgAjYCACADQRBqJICAgIAAC3wAAkAgA0EASA0AAkACQCABRQ0AIAIgAUEBIAMQo4CAgAAhAQwBCxCkgICAACADQQEQoYCAgAAhAQsCQCABDQAgACADNgIIIABBATYCBCAAQQE2AgAPCyAAIAM2AgggACABNgIEIABBADYCAA8LIABBADYCBCAAQQE2AgALAgALhQgBD38jgICAgABB0ABrIgMkgICAgABBAUEBIAIgAkH/AXFB/wFGGyACQYD+A3FBgARGGyEEAkACQAJAAkACQCACQYACcUUNACACQYCA/AdxQRB2IgINAQsgA0EgaiABKAIEIgUgASgCCCAEEL+AgIAAIAMtACQhAgJAIAMoAiAiBkF/Rg0AIAMgAykALDcARCADIAMpACU3AD0gAyACOgA8IAMgBjYCOCADQQRqIANBOGogBBCvgICAACADKAIEIgdBf0cNAiADLQAIIQILIAMgAjoAHyADI4OAgIAArUIghiADQR9qrYQ3AyAgA0E4aiOBgICAAEHJgsCAAGogA0EgahCRgoCAAAwCCyABKAIIIQYgASgCBCEFIANBADYCMCADQQA2AiggA0KAgICAEDcCICADIAI7AS4gA0EAOwEsAkACQAJAAkAgA0EgaiAFIAYQvICAgAAiAkH/AXFB/wFHDQAgA0EgaiAEELuAgIAAIgJB/wFxQf8BRg0BCyADIAI6AAggAygCICIGRQ0CIAMoAiQgBkEBEKKAgIAADAELIAMgAygCMDYCSCADIAMpAig3A0AgAyADKQIgNwM4IANBBGogA0E4aiAEEK+AgIAAIAMoAgQiB0F/Rw0CCyADLQAIIQILIAMgAjoAHyADI4OAgIAArUIghiADQR9qrYQ3AyAgA0E4aiOBgICAAEHJgsCAAGogA0EgahCRgoCAAAwBCyADLQASIQggAy8BECEJIAMoAgwhCiADKAIIIQsCQAJAIAMpAhSnIgwgDGwiAkEATg0AQQAhBgwBC0EBIQ0CQCACRQ0AEKSAgIAAQQEhBiACQQEQoYCAgAAiDUUNAQtBACEOIANBADYCDCADIA02AgggAyACNgIEAkACQCAMRQ0AQQAhBkEAIQ8DQCAPQQFqIQ8gDCEQIA4hAgNAIAIgCk8NAyALIAJqLQAAIRECQCAGIAMoAgRHDQAgA0EEahCagICAACADKAIIIQ0LIA0gBmogEToAACADIAZBAWoiBjYCDCACQQFqIQIgEEF/aiIQDQALIA4gDGohDiAPIAxHDQALCyAAIAMoAgw2AgggACADKQIENwIAIABBACAIIAlBAXEbOgAOIAAgDDoADSAAIAQ6AAwCQCAHRQ0AIAsgB0EBEKKAgIAACyABKAIAIgJFDQMgBSACQQEQooCAgAAMAwsgAiAKI4GAgIAAQbTwwIAAahCdgoCAAAALIAYgAhCKgoCAAAALIAMoAjghAiADKAI8IQYgAy8BQCEQIAAgAy8BQjsBDiAAIBA7AQwgACAGNgIIIAAgAjYCBCAAQX82AgAgASgCACICRQ0AIAUgAkEBEKKAgIAACyADQdAAaiSAgICAAAtEAQJ/AkACQAJAIAAtAAANACAAKAIMIgFFDQJBCCECDAELIAAoAggiAUUNAUEEIQILIAAgAmooAgAgAUEBEKKAgIAACwvlBAEFfyOAgICAAEEgayIHJICAgIAAEM2AgIAAIAcgATYCGCAHIAA2AhQgByABNgIQIAcgB0EQaiAFQQFxQQh0IARB/wFxQf8BIANBAXEbckGABCACQQFxGyAGQRB0chCegICAAAJAAkACQCAHKAIAIghBf0cNACOBgICAAEH0gcGAAGpBAToAACAHKAIIIQACQAJAIAcoAgQiBCAHKAIMIgFLDQAgACEDDAELAkAgAQ0AQQEhAyAAIARBARCigICAAAwBCyAAIARBASABEKOAgIAAIgNFDQMLI4GAgIAAQfSBwYAAaiIAIAM2AgQgACABNgIIDAELI4GAgIAAQfSBwYAAaiIBIActAA06AARBACEAIAFBADoAACAHLQAMIQkgBy0ADiEKIAcoAgQhAiAHQRBqQQEgBygCCCILEMyAgIAAIAcoAhAhBQJAIAtFDQAgC0EDcSEEIAIhAQJAIAtBBEkNACALQfz///8HcSEGQQAhAANAIAUgAGoiASACIABqIgMtAAA6AAAgAUEBaiADQQFqLQAAOgAAIAFBAmogA0ECai0AADoAACABQQNqIANBA2otAAA6AAAgBiAAQQRqIgBHDQALIARFDQEgAiAAaiEBCyAFIABqIQADQCAAIAEtAAA6AAAgAEEBaiEAIAFBAWohASAEQX9qIgQNAAsLAkAgCEUNACACIAhBARCigICAAAsjgYCAgABB9IHBgABqIgEgCToAESABIAo6ABAgASAFNgIIIAEgCzYCDAsjgYCAgAAhASAHQSBqJICAgIAAIAFB9IHBgABqDwtBASABEIqCgIAAAAsNACAAIAEQ7ICAgAAPCw8AIAAgASACEO6AgIAADwsRACAAIAEgAiADEO+AgIAADwsDAA8L5AMBEn8CQCACRQ0AIAEgAmohBSACIANrIQYgBC4BBiIHQQFqIQggBC8BBCIJQX9qwSEKIAQvAQIhCyAAKAIEIQwgACgCCCENIAAuARAhDiAELwEAIQNBACEPA0BBBEEAIA8gBkYbIRAgD0EBaiEPIAEiAkEBaiEBIAItAABB/wFxIRFBByESIAMhAgJAA0AgESASQQdxdkEBcSETIBJBf2ohFCALIQACQANAIAIgAkEBaiIDIALBIhUgB0obwSIWQQFIDQUCQAJAAkACQAJAAkACQAJAIAkgFmvBQQRvQf//A3EOAwECAAILIADBQQBKDQMgAkH//wNxIAhB//8DcUcNAQwFCyAAwSAKSA0BIAJB//8DcSAIQf//A3FGDQQLIAJBf2ohAyAAIRYMBAsgAEEBaiELDAELIABBf2ohCwsgBCALOwECIAshFgwBCyACQX5qIQMgACEWCyAEIAM7AQAgAMFBD3YgDnEgAGrBIA5sIBVBD3YgDnEgAmrBaiIVIA1PDQEgFiEAIAMhAiAMIBVBAXRqIhUtAAANAAsgFSATOgABIBVBAjoAACAQIBJIIQAgFCESIAMhAiAARQ0CDAELCyAVIA0jgYCAgABBtPHAgABqEJ2CgIAAAAsgASAFRw0ACwsLrQEBAn8jgICAgABBEGsiBSSAgICAAAJAIAIgAWoiASACTw0AQQBBABCKgoCAAAALIAVBBGogACgCACICIAAoAgRBCEEEIARBAUYbIgYgAkEBdCICIAEgAiABSxsiAiAGIAJLGyICIAMgBBCngICAAAJAIAUoAgRBAUcNACAFKAIIIAUoAgwQioKAgAAACyAFKAIIIQQgACACNgIAIAAgBDYCBCAFQRBqJICAgIAAC7YBAgJ/AX5BASEGQQQhBwJAAkAgBa0gA61+IghCIIinRQ0AQQAhAwwBCwJAIAinIgNBgICAgHggBGtNDQBBACEDDAELAkACQAJAAkAgAUUNACACIAUgAWwgBCADEKOAgIAAIQcMAQsCQCADDQAgBCEHDAILEKSAgIAAIAMgBBChgICAACEHCyAHDQAgACAENgIEDAELIAAgBzYCBEEAIQYLQQghBwsgACAHaiADNgIAIAAgBjYCAAuyCQEXfwJAAkACQAJAAkACQCABLwEMQQFHDQBBACECQQAhAwJAIAEuARAiBEECSA0AIARBf2ohAyAEQX9qQf//A3EiBSAEbCIGQQFqIQcgBkEBdCABKAIEIghqQQNqIQYgASgCCCEJQQAhAgNAIAcgCU8NAyACIAYtAABBf3NBAXFBASAGQX9qLQAAG2ohAiAGQQJqIQYgB0EBaiEHIANBf2oiAw0ACyAEQQF0IQogBEF/aiELIAggBCAFaiIHQQF0aiEGQQAhAwNAIAcgCU8NBCAHIARqIQcgAyAGQQFqLQAAQX9zQQFxQQEgBi0AABtqIQMgBiAKaiEGIAtBf2oiCw0ACwsgAyACaiACIAMgAiADSxtBD2xqIQYMBAtBACEMIAFBARCpgICAACENIAFBABCpgICAACEOAkAgAS4BECIIQX9qwSIPQQBKDQAgASgCCCEHIAEoAgQhCgwDCyABKAIEIQogASgCCCEHQQAhECAIQQF0IgQhEUEBIRJBACETQQAhDAJAAkACQANAIBNBAWohEyARIQkgDyELIBAhAiASIQYCQANAIAZBf2ogB08NASAGIAdPDQMgCCAGaiIGQX9qIAdPDQQgBiAHTw0FAkAgCiACaiIDLQAAIgUgA0ECai0AAEH/AXFHDQAgA0EBai0AACEUIANBA2otAAAhFSAKIAlqIgMtAAAhFiADQQFqLQAAIRcgA0EDai0AACEYIANBAmotAAAhAwJAAkACQAJAIAUOAwIBAAILIBUgFHNBAXENAyAWQf8BcUECRw0DIANB/wFxQQJHDQMgFyAVc0EBcQ0DIBggF3NBAXFFDQIMAwsgFSAUc0EBcQ0CIBZB/wFxQQFHDQIgA0H/AXFBAUcNAiAXIBVzQQFxDQIgGCAXc0EBcUUNAQwCCyADIBZyQf8BcQ0BCyAMQQNqIQwLIAkgBGohCSACIARqIQIgC0F/aiILDQALIBFBAmohESAQQQJqIRAgEkEBaiESIBMgD0YNBwwBCwsgBkF/aiAHI4GAgIAAQaTxwIAAahCdgoCAAAALIAYgByOBgICAAEGk8cCAAGoQnYKAgAAACyAGQX9qIAcjgYCAgABBpPHAgABqEJ2CgIAAAAsgBiAHI4GAgIAAQaTxwIAAahCdgoCAAAALIAcgCSOBgICAAEGk8cCAAGoQnYKAgAAACyAHIAkjgYCAgABBpPHAgABqEJ2CgIAAAAsgAUEBEKqAgIAAIQtBACEDIAFBABCqgICAACEEIAdFDQFBACECAkACQCAHQQFGDQAgB0EBcSEFIAdBfnEhCSAKIQZBACEDQQAhAgNAIAIgBkEBai0AAEEBcUEAIAYtAAAbaiAGQQNqLQAAQQFxQQAgBkECai0AABtqIQIgBkEEaiEGIAkgA0ECaiIDRw0ACyAFRQ0BCyACIAogA0EBdGoiBkEBai0AAEEBcUEAIAYtAAAbaiECCyAOIA1qIAxqIAtqIARqIAJByAFsIAduIgZBnP8DakHkACAGayAGQeMASxtqIQYLIAAgBjsBFCAAIAEoAhA2AhAgACABKQIINwIIIAAgASkCADcCAA8LI4GAgIAAQbTywIAAahCsgoCAAAALtQMBD38jgICAgABBEGsiAiSAgICAACACIAE6AA8CQAJAIAAuARAiA0EBTg0AQQAhBAwBCyAAKAIEIQUgACgCCCEGQQAhB0EAIQQDQCAHIgggA2whCSAIQQFqIQcgAkEPaiEKQQAhAEEAIQtBACEBA0AgDSEMIAEhDkEBIQ8CQAJAAkADQCALIRACQAJAIApFDQAgAMEiASADTg0AIAFBD3YgA3EgAGrBIQECQAJAIAotAAANACABIANsIAhqIgEgBkkNASABIAYjgYCAgABBpPHAgABqEJ2CgIAAAAsgCSABaiIBIAZPDQQLIABBAWohACAFIAFBAXRqIgEtAAEhDSABLQAAIQEgECELDAELQf8BIQtBACEBQQAhCiAQQf8BcUH9AUsNBAsgAUH/AXEgDkH/AXEiEEcNAgJAAkACQCAQDgMCAAECCyAMIA1zQQFxRQ0BDAQLIAwgDXNBAXENAwsgD0EBaiEPDAALCyABIAYjgYCAgABBpPHAgABqEJ2CgIAAAAsgD0F+akEAIA9B//8DcUEESxsgBGohBAwBCwsgByADRw0ACwsgAkEQaiSAgICAACAEC74HAQ1/I4CAgIAAQRBrIgIkgICAgABBmP0DIQMCQCAALgEQIgRBAUgNACAEQQdJDQAgBEF6asEhBUEAIQZBACEHA0AgAiAHOwEOIAdBAWrBIQdBACEIA0AgCEEHaiEJAkACQAJAAkACQAJAAkACQANAEKSAgIAAQQhBBBChgICAACEDAkACQCABDQAjgYCAgAAhCiADRQ0EIApBhPLAgABqIQoMAQsjgYCAgAAhCiADRQ0EIApBnPLAgABqIQoLIAhBAWohCyADIAA2AgAgAyACQQ5qNgIEAkACQCAIQfj/AUoNACAJwUF5aiAIRw0AIAMgCCAKKAIUIgwRgICAgACAgICAAEUNACADIAsgDBGAgICAAICAgIAADQAgAyAIQQJqIAwRgICAgACAgICAAEUNACADIAhBA2ogDBGAgICAAICAgIAARQ0AIAMgCEEEaiAMEYCAgIAAgICAgABFDQAgAyAIQQVqIAwRgICAgACAgICAAA0AIAMgCEEGaiAMEYCAgIAAgICAgABFDQAgCEGDgH5MDQggCEEHasEhDQJAIAhBfGoiDkH//wNxIARB//8DcSIJTw0AIAMgDiAMEYCAgIAAgICAgAANAgsCQCAIQX1qIg5B//8DcSAJTw0AIAMgDiAMEYCAgIAAgICAgAANAgsCQCAIQX5qIg5B//8DcSAJTw0AIAMgDiAMEYCAgIAAgICAgAANAgsgCEF/aiIOQf//A3EgCU8NCCADIA4gDBGAgICAAICAgIAARQ0IIA0gCEELasFODQgMAwsCQCAKKAIAIghFDQAgAyAIEYGAgIAAgICAgAALAkAgCigCBCIIRQ0AIAMgCCAKKAIIEKKAgIAACyAJQQFqIQkgCyEIIAsgBUgNAQwJCwsgDSAIQQtqwU4NBQsgDSAESQ0CDAMLQQRBCBCMgoCAAAALQQRBCBCMgoCAAAALIAMgDSAMEYCAgIAAgICAgAANAgsCQCAIQQhqIg1B//8DcSAJTw0AIAMgDSAMEYCAgIAAgICAgAANAgsCQCAIQQlqIg1B//8DcSAJTw0AIAMgDSAMEYCAgIAAgICAgAANAgsgCEEKaiINQf//A3EgCU8NACADIA0gDBGAgICAAICAgIAADQELIAZBKGohBgsCQCAKKAIAIglFDQAgAyAJEYGAgIAAgICAgAALAkAgCigCBCIJRQ0AIAMgCSAKKAIIEKKAgIAACyAIQQFqIQggBSALwUoNAQsLIAcgBEgNAAsgBkGYfWohAwsgAkEQaiSAgICAACADC4sBAQJ/AkAgACgCBC4BACICQQ92IAAoAgAiAy4BECIAcSACasEgAGwgAcFBD3YgAHEgAWrBaiIAIAMoAggiAU8NACADKAIEIABBAXRqIgEtAAEhA0EAIQACQAJAIAEtAAAOAwEAAAELIAMhAAsgAEEBcQ8LIAAgASOBgICAAEGk8cCAAGoQnYKAgAAAC4sBAQJ/AkAgAcFBD3YgACgCACICLgEQIgNxIAFqwSADbCAAKAIELgEAIgFBD3YgA3EgAWrBaiIBIAIoAggiAE8NACACKAIEIAFBAXRqIgAtAAEhA0EAIQECQAJAIAAtAAAOAwEAAAELIAMhAQsgAUEBcQ8LIAEgACOBgICAAEGk8cCAAGoQnYKAgAAAC4sBAQJ/AkAgACgCBC4BACICQQ92IAAoAgAiAy4BECIAcSACasEgAGwgAcFBD3YgAHEgAWrBaiIAIAMoAggiAU8NACADKAIEIABBAXRqIgEtAAEhA0EAIQACQAJAIAEtAAAOAwEAAAELIAMhAAsgAEEBcQ8LIAAgASOBgICAAEGk8cCAAGoQnYKAgAAAC4sBAQJ/AkAgAcFBD3YgACgCACICLgEQIgNxIAFqwSADbCAAKAIELgEAIgFBD3YgA3EgAWrBaiIBIAIoAggiAE8NACACKAIEIAFBAXRqIgAtAAEhA0EAIQECQAJAIAAtAAAOAwEAAAELIAMhAQsgAUEBcQ8LIAEgACOBgICAAEGk8cCAAGoQnYKAgAAAC50HARV/I4CAgIAAQTBrIgMkgICAgAAgASgCACEEIANBBGogASgCBCIFIAEoAgggAS8BDCIGIAEvAQ4iByACELCAgIAAAkACQAJAAkAgAygCBCIIQX9HDQAgAy0ACCEBIABBfzYCACAAIAE6AAQgBA0BDAILIAdBAXQiCUEJaiIKIAdBAnQiC0ERaiIMIAZBAXEbIg0gDWwiDsEiD0EBdCEQQQAhASAPQQBIDQIgAygCGCERIAMoAhQhEiADKAIQIRMgAygCDCEUIAMoAgghFRCkgICAAEEBIQEgEEEBEKGAgIAAIhZFDQIgFiEBAkAgDkH//wNxQQFGDQAgD0F/aiIXQQdxIQ4gFiEBAkAgD0F+akEHSQ0AIBdBeHEhFyAWIQEDQCABQQA6AAAgAUEOakEAOgAAIAFBDGpBADoAACABQQpqQQA6AAAgAUEIakEAOgAAIAFBBmpBADoAACABQQRqQQA6AAAgAUECakEAOgAAIAFBEGohASAXQXhqIhcNAAsgDkUNAQsDQCABQQA6AAAgAUECaiEBIA5Bf2oiDg0ACwsgAUEAOgAAIAMgDTsBLCADIAI6AC4gAyAHOwEqIAMgDzYCJCADIBY2AiAgAyAPNgIcIAMgBjsBKCADQRxqELGAgIAAAkACQCAGQQFxDQBBBiEOQRAhFyAMIQogCyEJQQAhAQwBC0EAIQ5BCCEXQQAhAQJAAkAgAkH/AXEOAgABAgsgB0H//wNxQQFGIQEMAQsgB0H//wNxQQNGIQELIAMgDjsBCiADIAo7AQggAyAXIAlqIg47AQYgAyAOOwEEIANBHGogFSAUIAEgA0EEahClgICAACADQRxqIBIgEUEAIANBBGoQpYCAgAAgA0EEaiADQRxqELKAgIAAIAMoAgghCiADKAIEIQwCQCADKAIMIgtFDQAgCyEPIAohDiAKIQEDQCABQQFqLQAAIQlBACEXAkACQCABLQAADgMBAAABCyAJIRcLIA4gF0EBcToAACAOQQFqIQ4gAUECaiEBIA9Bf2oiDw0ACwsgACACOgAUIAAgBzsBDiAAIAY7AQwgACALNgIIIAAgCjYCBCAAIA3BNgIQIAAgDEEBdDYCACAWIBBBARCigICAAAJAIBNFDQAgEiATQQEQooCAgAALAkAgCEUNACAVIAhBARCigICAAAsgBEUNAQsgBSAEQQEQooCAgAALIANBMGokgICAgAAPCyABIBAQioKAgAAAC7wOAQt/I4CAgIAAQdAAayIGJICAgIAAIARBf2ohBwJAAkACQAJAIANBAXFFDQAgB0H//wNxQQRPDQIjgYCAgABBgJjAgABqIARB//8DcUEGdGogBUH/AXFBBHRqIggoAswTIQkgCCgCyBMhCiAIKALEEyELIAgoAsATIgwNASALDQEgCg0BIAkNAQwCCyAHQf//A3FBJ0sNASOBgICAAEGAmMCAAGogBEH//wNxQQZ0aiAFQf8BcUEEdGpBQGoiCCgCDCEJIAgoAgghCiAIKAIEIQsgCCgCACEMCyALIAlqIghBA3QhCUEAIQ0CQAJAAkACQCAIQf////8BSw0AIAlB/P///wdLDQACQAJAIAkNAEEEIQ5BACEIDAELEKSAgIAAQQQhDSAJQQQQoYCAgAAiDkUNAQsgBkEANgIUIAYgDjYCECAGIAg2AgwgAiAMIAtsIg9JDQEgDEUNAgJAAkAgDw0AQQAhEAwBC0EAIRACQCAPIAxuIgsgDyALIAxsa0EAR2oiCyAITQ0AIAZBDGpBACALQQRBCBCmgICAACAGKAIQIQ4gBigCFCEQCyAOIBBBA3RqIQsgDyEJIAEhCANAIAsgCDYCACALQQRqIAkgDCAJIAxJGyINNgIAIAtBCGohCyAQQQFqIRAgCCANaiEIIAkgDWsiCQ0ACwsgBiAQNgIUIApFDQMgAiAPayILRQ0DAkAgCyAKbiIJIAsgCSAKbGtBAEdqIgkgBigCDCAQa00NACAGQQxqIBAgCUEEQQgQpoCAgAAgBigCECEOIAYoAhQhEAsgASAPaiEIIA4gEEEDdGohCQNAIAkgCDYCACAJQQRqIAsgCiALIApJGyINNgIAIAlBCGohCSAQQQFqIRAgCCANaiEIIAsgDWsiCw0ADAQLCyANIAkQioKAgAAAC0EAIA8gAiOBgICAAEHk8sCAAGoQnIKAgAAACyOBgICAACILQa2RwIAAakE3IAtB1PLAgABqEJuCgIAAAAsCQAJAIANBAXFFDQACQCAHQf//A3FBBE8NACOBgICAAEHAksCAAGogBEH//wNxQQR0aiAFQf8BcUECdGooAvAEIg0NAgsgAEF/NgIAIABBAToABCAGKAIMIgtFDQMgBigCECALQQN0QQQQooCAgAAMAwsjgYCAgABBwJLAgABqIARB//8DcUEEdGogBUH/AXFBAnRqQXBqKAIAIQ0LIBBBDGwhB0EAIQsCQCAQQarVqtUASw0AIAYoAhAhCgJAAkAgBw0AQQQhBUEAIQIMAQsQpICAgABBBCELIBAhAiAHQQQQoYCAgAAiBUUNAQsCQCAQRQ0AIAohCyAFIQkgECEIA0AgBkEoaiALKAIAIAtBBGooAgAgDRC+gICAACAJIAYoAjA2AgggCSAGKQIoNwIAIAtBCGohCyAJQQxqIQkgCEF/aiIIDQALQQAhCQJAIAogEEEDdCIDakF8aigCACIEIBBsIgtBAEgNAAJAAkAgCw0AQQEhDQwBCxCkgICAAEEBIQkgC0EBEKGAgIAAIg1FDQELQQAhCCAGQQA2AjAgBiANNgIsIAYgCzYCKAJAAkACQCAERQ0AQQAhDQwBCyAGIAYoAjA2AiAgBiAGKQIoNwMYDAELA0AgAyEJIAohCwNAAkAgDSALQQRqKAIATw0AIAsoAgAgDWotAAAhDAJAIAggBigCKEcNACAGQShqEI2CgIAACyAGKAIsIAhqIAw6AAAgBiAIQQFqIgg2AjALIAtBCGohCyAJQXhqIgkNAAsgDUEBaiINIARHDQALIAYgBigCMDYCICAGIAYpAig3AxgLQQAhCQJAIAUgEEEMbGpBfGooAgAiBCAQbCILQQBIDQACQAJAIAsNAEEBIQ0MAQsQpICAgABBASEJIAtBARChgICAACINRQ0BC0EAIQggBkEANgJMIAYgDTYCSCAGIAs2AkQCQCAERQ0AIAVBBGohA0EAIQ0DQCAHIQkgAyELA0ACQCANIAtBBGooAgBPDQAgCygCACANai0AACEMAkAgCCAGKAJERw0AIAZBxABqEI2CgIAACyAGKAJIIAhqIAw6AAAgBiAIQQFqIgg2AkwLIAtBDGohCyAJQXRqIgkNAAsgDUEBaiINIARHDQALCyAGIAYoAkw2AjwgBiAGKQJENwI0IAAgBikDGDcCACAGIAYoAiA2AjAgACAGKQMwNwIIIAAgBikDODcCECAFIQsDQAJAIAsoAgAiCUUNACALQQRqKAIAIAlBARCigICAAAsgC0EMaiELIBBBf2oiEA0ACyAFIAJBDGxBBBCigICAACAGKAIMIgtFDQUgCiALQQN0QQQQooCAgAAMBQsgCSALEIqCgIAAAAsgCSALEIqCgIAAAAsjgYCAgAAiC0GdkcCAAGpBECALQdTwwIAAahCngoCAAAALIAsgBxCKgoCAAAALIABBfzYCACAAQQE6AAQLIAZB0ABqJICAgIAAC84LAQx/IABBA0EDELWAgIAAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAvAQwiAUEBRw0AIAAvAQ4hAiAAQQAQuoCAgAAgAC4BECIDQX9qwSIEQQhIDQsgACgCCCIFQQggBUEISxshBiAFQQlJDQIgACgCBCIHQRFqIQhBCCEJDAELIABB/P8DQQMQtYCAgAAgAEEDQfz/AxC1gICAACAALwEOIgJBAUYNBSACQX5qQf//A3FBBUkNBCACQXlqIgPBIQgCQAJAIANB//8DcUEiTw0AI4GAgIAAQeT3wIAAaiAIQQN0aiIDKAIAIgogAygCBEEBdCILaiEEIAohCQwBCyAIQSIjgYCAgABBxPHAgABqEJ2CgIAAAAsDQCALIQggCiEDA0AgACAJLwEAIAMvAQAQt4CAgAAgA0ECaiEDIAhBfmoiCA0ACyAJQQJqIgkgBEcNAAsgAEEAELqAgIAADAYLAkADQCAIQX9qQQE6AAAgCCAJQX9zQQFxOgAAIAnBQQFqIgrBIgsgCkcNASALIARKDQEgCEECaiEIIAYgCUEBaiIJRg0CDAALC0EIIQgCQCAEQQhGDQAgA0EBdCEMIANBA3QhCiAHIANBBHRqIQkDQCAKIAVPDQMgCUEBOgAAIAlBAWogCEF/c0EBcToAACAIwUEBaiILwSIGIAtHDQkgCSAMaiEJIAogA2ohCiAIQQFqIQggBiAETA0ADAkLCyADQQN0IgMgBU8NAiAHIANBAXRqIghBAToAAEEJIQMMBgsgBiAFI4GAgIAAQbTxwIAAahCdgoCAAAALIAogBSOBgICAAEG08cCAAGoQnYKAgAAACyADIAUjgYCAgABBtPHAgABqEJ2CgIAAAAsgAEH5/wNB+f8DELeAgIAACyAAQQAQuoCAgAALIAAuARAiA0F3asEiBEEISA0CIANBBmwiBUEIaiIKIAAoAggiBk8NBCADQQxsIAAoAgQiB2pBEWohCEEIIQkCQANAIAhBf2pBAToAACAIIAlBf3NBAXE6AAAgCcFBAWoiCsEiCyAKRw0BIAsgBEoNASAIQQJqIQggBSAJQQFqIglqIgogBk8NBgwACwtBCCEIAkAgBEEIRg0AIANBAXQhDCADQQN0QQZyIQogA0EEdCAHakENaiEJA0AgCiAGTw0HIAlBf2pBAToAACAJIAhBf3NBAXE6AAAgCMFBAWoiC8EiBSALRw0DIAkgDGohCSAKIANqIQogCEEBaiEIIAUgBEwNAAwDCwsgA0EDdEEGciIDIAZPDQYgByADQQF0aiIIQQE6AABBESEDCyAIQQE6AAELIAENAQsgAkF/akH//wNxQQZJDQAgAkF5aiIIwSEJIAhB//8DcUEhSw0GI4GAgIAAQZzKwIAAaiAJQQJ0aigCACEKIAAoAgQhCyAAKAIIIQlBgIAIIQBBuH8hCANAI4GAgIAAQaTMwIAAaiAIaiIEQcoAai4BACIGQQ92IANxIAZqwSADbCAEQcgAai4BACIEQQ92IANxIARqwWoiBCAJTw0FIAsgBEEBdGoiBCAAIApxQQBHOgABIARBAToAACAAQQF2IQAgCEEEaiIIDQALQYCACCEAQbh/IQgDQCOBgICAAEHszMCAAGogCGoiBEHKAGouAQAiBkEPdiADcSAGasEgA2wgBEHIAGouAQAiBEEPdiADcSAEasFqIgQgCU8NBiALIARBAXRqIgQgACAKcUEARzoAASAEQQE6AAAgAEEBdiEAIAhBBGoiCA0ACwsPCyAKIAYjgYCAgABBtPHAgABqEJ2CgIAAAAsgCiAGI4GAgIAAQbTxwIAAahCdgoCAAAALIAMgBiOBgICAAEG08cCAAGoQnYKAgAAACyAEIAkjgYCAgABBtPHAgABqEJ2CgIAAAAsgBCAJI4GAgIAAQbTxwIAAahCdgoCAAAALIAlBIiOBgICAAEHU8cCAAGoQnYKAgAAAC+QJAhF/An4jgICAgABBwAFrIgIkgICAgAACQAJAI4GAgIAAIgNBmZHAgABqIgQgA0GRkcCAAGoiAyABLwEMIgUbIgYgBEEEaiADQQhqIAUbIgNGDQAjgYCAgAAhBCABKAIIIgdBAXQhCCABKAIEIQkgAS0AEiEKIAEvAQ4hCyABLwEQIQxBASEBAkACQAJAAkACQCAHRQ0AEKSAgIAAIAhBARChgICAACIBRQ0BIAhFDQAgASAJIAj8CgAACyACIAo6AF4gAiALOwFaIAIgBTsBWCACIAw7AVwgAiAHNgJUIAIgATYCUCACIAc2AkwgAkHMAGogBi0AABC9gICAACAHQX9GDQQgAiAHNgJ8IAIgAkHMAGpBBGoiASkCCDcCiAEgAiABKQIANwKAASACQZABaiACQfwAahCogICAACACKAKQASINQX9GDQQgAiACKAKkATYCSCACIAIpApwBNwNAIAIgAikClAE3AzgCQCAEQZmRwIAAQZGRwIAAIAUbakEBaiIEIANHDQAgAiACKAJINgIwIAIgAikDQDcDKCACIAIpAzg3AyAMBgsgAyAEayEOIAJB6ABqIQ8gAkGUAWohBiACQZABakEYaiEDIAJBzABqQRhqIQEgB0UNAgNAIA0hECAELQAAIREQpICAgAAgCEEBEKGAgIAAIg1FDQICQCAIRQ0AIA0gCSAI/AoAAAsgAiAKOgCOASACIAs7AYoBIAIgBTsBiAEgAiAMOwGMASACIAc2AoQBIAIgDTYCgAEgAiAHNgJ8IAJB/ABqIBEQvYCAgAAgASACQfwAahCogICAACAGIAIoAkg2AhAgAyABKQIQNwIQIAYgAikDQDcCCCAGIAIpAzg3AgAgAyABKQIANwIAIAMgASkCCDcCCAJAAkACQCACLwG8ASACLwGkAUkNACAQIQ0gAyERIAIoAqgBIhINAQwCCyACIA8pAgA3AzggAiAPKQIINwNAIAIgDygCEDYCSCACQZABaiERIAIoAmQhDSAQIRIgEEUNAQsgESgCBCASQQF0QQEQooCAgAALIARBAWohBCAOQX9qIg4NAAwECwtBASAIEIqCgIAAAAtBASAIEIqCgIAAAAsDQCANIQggAiAKOgCOASACIAs7AYoBIAIgBTsBiAEgAiAMOwGMASACQQA2AoQBIAJCgICAgBA3AnwgAkH8AGogBC0AABC9gICAACABIAJB/ABqEKiAgIAAIAYgAigCSDYCECADIAEpAhA3AhAgBiACKQNANwIIIAYgAikDODcCACADIAEpAgA3AgAgAyABKQIINwIIAkACQAJAIAIvAbwBIAIvAaQBSQ0AIAghDSADIQcgAigCqAEiEA0B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gIAAIAItALAEQQNHDQAgAkG0BGoQsYKAgAALIAJB4ARqJICAgIAADwsQz4CAgAAAC0EAIAFBgAQjgYCAgABBwPvAgABqEJyCgIAAAAsUACAAKAIAIAAoAgQgARC0goCAAAufAQIDfwF+I4CAgIAAQSBrIgIkgICAgAAgASgCBCEDIAEoAgAhBCACIAAoAgAiASkCADcCACACI4mAgIAArUIghiIFIAFBDGqthDcDGCACIAUgAUEIaq2ENwMQIAIjgoCAgABBkICAgABqrUIghiACrYQ3AwggBCADI4GAgIAAQYCAwIAAaiACQQhqEJqCgIAAIQEgAkEgaiSAgICAACABC4cDAgN/AX4jgICAgABBIGsiAiSAgICAACOBgICAAEHQgsGAAGoiAy0AACEEIANBAToAACOKgICAAK1CIIYhBQJAAkAgBA0AIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEHaj8CAAGogAkEQahDpgICAACACQQRqENCAgIAAEOaAgIAAIQECQAJAAkACQBD+gICAAEH/AXEOAwABAgMLIAJBEGogAkEfaiOCgICAAEGVgICAAGpBABDngICAACACQRBqENCAgIAADAILIAJBEGogAkEfaiOCgICAAEGVgICAAGpBARDngICAACACQRBqENCAgIAADAELIAJBEGogAkEfaiOBgICAAEGy1cCAAGpBnQEQ6YCAgAAgAkEQahDQgICAAAsgAUEAOgAADAELIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEG2jsCAAGogAkEQahDpgICAACACQQRqENCAgIAACyACQSBqJICAgIAACwkAEP+AgIAAAAu8AgMCfwF+AX8jgICAgABBIGsiAySAgICAABDmgICAACEEIAApAgAhBSADIAI2AhggAyABNgIUIAMgBTcCDAJAAkAji4CAgAAoAgAiBkECSw0AIANBDGpBABDggICAAAwBCyADIAZBeGo2AhwgA0EMaiADQRxqEOCAgIAACwJAAkACQAJAIAAoAggtAAAOAwABAgMLIANBDGogASACKAIkQQAQ54CAgAAgA0EMahDQgICAAAwCCyADQQxqIAEgAigCJEEBEOeAgIAAIANBDGoQ0ICAgAAMAQsjgYCAgABBlP3AgABqIgAtAAAhBiAAQQA6AAAgBkUNACADQQxqIAEjgYCAgABBstXAgABqQZ0BIAIoAiQRg4CAgACAgICAACADQQxqENCAgIAACyAEQQA6AAAgA0EgaiSAgICAAAuPAQEDfyOAgICAAEEQayIAJICAgIAAI4GAgIAAQdGCwYAAaiIBLQAAIQIgAUEBOgAAIAAgAjoADwJAIAJBAUcNAEEAIABBD2ojgYCAgAAiAEGQkcCAAGogAEHQ2MCAAGpBwQAgAEHM/MCAAGoQzoCAgAAACyOBgICAACECIABBEGokgICAgAAgAkHRgsGAAGoLYAEBfyOAgICAAEEQayIEJICAgIAAIAQgAzoAByAEI4yAgIAArUIghiAEQQdqrYQ3AwggACABI4GAgIAAQduCwIAAaiAEQQhqIAIRg4CAgACAgICAACAEQRBqJICAgIAAC0cBAX8jgICAgABBEGsiACSAgICAACAAQQRqIABBD2ojgYCAgABBgNbAgABqQYUBEOmAgIAAIABBBGoQ0ICAgAAQ5ICAgAAAC7kBAQF/I4CAgIAAQRBrIgQkgICAgAAgAEH/AToAACAEIAE2AgggBCAAKQIANwMAIAQjgYCAgABBkPvAgABqIAIgAxCagoCAACEBIAQtAAAhAwJAAkACQCABRQ0AIANB/wFxQf8BRw0BI4GAgIAAIgRBpdTAgABqQa0BIARB6PrAgABqEJuCgIAAAAsgA0H/AXFBA0cNASAEQQRyELGCgIAADAELIAAgBCkDADcCAAsgBEEQaiSAgICAAAvtAgEDfyOAgICAAEHAAGsiASSAgICAAEH/ASECAkAgAC0ADQ0AQQEhAiOBgICAAEGMgsGAAGooAgBBAUsNABD+gICAACECCyABIAI6ABsgASAAKAIINgIcIAFBEGogACgCACAAKAIEEICBgIAAIAEgASkDEDcCICABIAFBG2o2AjAgASABQSBqNgIsIAEgAUEcajYCKCABQQhqQQAQgYGAgAACQAJAAkAgASgCCEEBcQ0AIAEoAgwiAA0BCyABQShqIAFBP2ojgYCAgABBmP3AgABqEOWAgIAADAELI4GAgIAAIQIgAUEoaiAAQQhqEPmAgIAAIgNBBGogAkHA/cCAAGoQ5YCAgAAgA0EAOgAAIAEgABCBgYCAACABKAIAQQFxDQAgASgCBCEAIAFBATYCNCABIAA2AjggAEUNACAAIAAoAgAiAkF/ajYCACACQQFHDQAgAUE0akEEahDegICAAAsgAUHAAGokgICAgAALbgEBfyOAgICAAEEgayICJICAgIAAIAIgACABEK2BgIAANgIEIAIjiYCAgACtQiCGIAJBBGqthDcDECACQQhqIAJBH2ojgYCAgABBlo/AgABqIAJBEGoQ6YCAgAAgAkEIahDQgICAABDkgICAAAALcQEBfyOAgICAAEEQayICJICAgIAAAkACQAJAIAFBCEsNACABIABNDQELIAJBADYCDCACQQxqIAFBBCABQQRLGyAAEIWCgIAAIQFBACACKAIMIAEbIQEMAQsgABD9gYCAACEBCyACQRBqJICAgIAAIAELCQAQ5ICAgAAACwoAIAAQgIKAgAALnQEBAn8jgICAgABBEGsiBCSAgICAAAJAAkACQCACQQhLDQAgAiADTQ0BC0EAIQUgBEEANgIMIARBDGogAkEEIAJBBEsbIAMQhYKAgAANASAEKAIMIgJFDQECQCABIAMgASADSRsiA0UNACACIAAgA/wKAAALIAAQgIKAgAAgAiEFDAELIAAgAxCDgoCAACEFCyAEQRBqJICAgIAAIAULOAIBfwF+I4CAgIAAQRBrIgEkgICAgAAgACkCACECIAEgADYCDCABIAI3AgQgAUEEahDagICAAAALDQAgASAAEPKAgIAAAAsvAQF/I4CAgIAAQRBrIgIkgICAgAAgAiABNgIMIAIgADYCCCACQQhqENiAgIAAAAvvAQIDfwF+I4CAgIAAQRBrIgIkgICAgAAgASgCBCEDIAEoAgAhBCAALQAAIQAgAkEEahD9gICAACACKQIIIQUCQCACKAIEIgFBf0cNACAFQv8Bg0IDUg0AIAJBDGoQsYKAgAALAkACQAJAAkAgBCOBgICAAEGP2sCAAGpBESADKAIMIgMRhICAgACAgICAAA0AIABBAXENASAEI4GAgIAAQaDawIAAakHYACADEYSAgIAAgICAgABFDQELQQEhBCABQQBKDQEMAgtBACEEIAFBAEwNAQsgBacgAUEBEKKAgIAACyACQRBqJICAgIAAIAQL8AIBA38jgICAgABBEGsiACSAgICAACOBgICAAEHA/sCAAGooAgQhASAAQQA2AgACQAJAAkACQCAAIAEQ5YGAgAANAAJAAkAgACgCACICDQAjgYCAgABB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gABBEGsiAiSAgICAACACQQA2AgwCQAJAIAFBgAFJDQAgAUE/cUGAf3IhAyABQQZ2IQQCQCABQYAQTw0AIAIgAzoADSACIARBwAFyOgAMQQIhAQwCCyABQQx2IQUgBEE/cUGAf3IhBAJAIAFB//8DSw0AIAIgAzoADiACIAQ6AA0gAiAFQeABcjoADEEDIQEMAgsgAiADOgAPIAIgBDoADiACIAVBP3FBgH9yOgANIAIgAUESdkFwcjoADEEEIQEMAQsgAiABOgAMQQEhAQsCQCABIAAoAggiACgCACAAKAIIIgNrTQ0AIAAgAyABQQFBARDXgICAACAAKAIIIQMLAkAgAUUNACAAKAIEIANqIAJBDGogAfwKAAALIAAgAyABajYCCCACQRBqJICAgIAAQQALGwAgACOBgICAAEH4+sCAAGogASACEJqCgIAAC60CAQR/I4CAgIAAQRBrIgIkgICAgAAgAkEANgIEAkACQCABQYABSQ0AIAFBP3FBgH9yIQMgAUEGdiEEAkAgAUGAEE8NACACIAM6AAUgAiAEQcABcjoABEECIQEMAgsgAUEMdiEFIARBP3FBgH9yIQQCQCABQf//A0sNACACIAM6AAYgAiAEOgAFIAIgBUHgAXI6AARBAyEBDAILIAIgAzoAByACIAQ6AAYgAiAFQT9xQYB/cjoABSACIAFBEnZBcHI6AARBBCEBDAELIAIgAToABEEBIQELIAJBCGogAiACQQRqIAEQgoGAgAACQCACLQAIIgFB/wFGDQACQCAALQAAQQNHDQAgAEEEahCxgoCAAAsgACACKQMINwIACyACQRBqJICAgIAAIAFB/wFHCxsAIAAjgYCAgABBkPvAgABqIAEgAhCagoCAAAsbACAAI4GAgIAAQdD7wIAAaiABIAIQmoKAgAALRgACQAJAAkAgAQ0AIANFDQIQpICAgAAgAyACEKGAgIAAIgJFDQEMAgsgACABIAIgAxCjgICAACICDQELEP+AgIAAAAsgAgsJABDtgICAAAALAgALYwEBfwJAIAJBAEgNAAJAIAJFDQADQAJAIAFBBGooAgAiA0UNACAAIAEoAgAgAxCxgYCAAA8LIAFBCGohASACQX9qIgINAAsLIABBAEEAELGBgIAADwsjjoCAgABBHDYCAEF/C+YBAgF/An4jgICAgABBEGsiAiSAgICAAAJAAkAgAQ0AQQAhAAwBCwJAIAAjkYCAgABHDQBBACEAENeBgIAAIQMgAUEANgIMIAEgA0KAlOvcA4AiBDcDACABIAMgBEKAlOvcA359PgIIDAELAkAgACOSgICAAEcNACACENmBgIAAQQAhACABQQA2AgwgAUH/k+vcAyACKAIIIAIpAwAiA0IAUxs2AgggASADQv///////////wAgA0L///////////8AVBs3AwAMAQsjjoCAgABBHDYCAEF/IQALIAJBEGokgICAgAAgAAv8AQICfwF+I4CAgIAAQTBrIgMkgICAgAACQAJAIAAgA0EoahC5gYCAAEEATg0AQX8hAAwBCwJAAkACQCADKAIsIgQoAggiAEUNACADKAIoIANBEGogABGAgICAAICAgIAAQQBIDQEgA0EQaiABIAIQvIGAgAAhAAwCCwJAIAQoAkQiAEUNACADKAIoIAEgAkEAQQBBACAAEYaAgIAAgICAgAAhAAwCCyOOgICAAEE6NgIAC0F/IQALIAMpAygiBaciAiACKAIAQX9qIgI2AgAgAyAFNwMQIAINACADIAMpAxA3AwggA0EIahC6gYCAAAsgA0EwaiSAgICAACAACzwBAX8jgICAgABBEGsiASSAgICAAAJAIABB/wFLDQAgABDKgYCAAAALIAFBAToADyABQQ9qEMmBgIAAAAsgAAJAI4GAgIAAQYSAwYAAaigCAEF/Rw0AELSBgIAACwv9AgEMfyOAgICAAEEQayIAJICAgIAAI4GAgIAAIQEgAEEIahDIgYCAAAJAAkACQCAAKAIMIgINACABQdiCwYAAaiEDDAELIAJBAWoiAUUNASABQQQQgoKAgAAiA0UNASAAKAIIIQEgAyEEQQAhBQNAIAFBCGooAgAhBiABKAIAIQcgBCABQQxqKAIAIgggAUEEaigCACIJaiIKQQJqEP2BgIAAIgs2AgACQCALDQACQCAFRQ0AIAMhAQNAIAEoAgAQgIKAgAAgAUEEaiEBIAVBf2oiBQ0ACwsgAxCAgoCAAAwDCwJAIAlFDQAgCyAHIAn8CgAACyALIAlqIglBPToAAAJAIAhFDQAgCUEBaiAGIAj8CgAACyALIApqQQFqQQA6AAAgAUEQaiEBIARBBGohBCACIAVBAWoiBUcNAAsgAEEIahC9gYCAAAsjgYCAgABBhIDBgABq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NwMACyADQSBqJICAgIAAIAYLewECfwJAIAAoAgQiAUUNACAAKAIAIgIhAANAAkAgAEEEaigCAEUNACAAKAIAEICCgIAACyAAQgA3AgACQCAAQQxqKAIARQ0AIABBCGooAgAQgIKAgAALIABBCGpCADcCACAAQRBqIQAgAUF/aiIBDQALIAIQgIKAgAALCwoAIAAQgICAgAALCgAgABCBgICAAAsEACAACxgAAkAgACgCBEUNACAAKAIAEICCgIAACwsKACAAEIKAgIAACwQAIAALCgAgABCDgICAAAsEACAACwoAIAAQhICAgAALCgAgABCFgICAAAs1AQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCGgICAACAAIAEpAgg3AgAgAUEQaiSAgICAAAsOACAALQAAEIeAgIAAAAsLACAAEIiAgIAAAAsKACAAEImAgIAACz8BAX8jgICAgABBEGsiAiSAgICAACAAKAIAIAAoAgQgAkEIahCKgICAACABIAIpAgg3AgAgAkEQaiSAgICAAAt3AgF/AX4jgICAgABBEGsiAySAgICAACAAIAMQi4CAgAACQAJAAkACQCADLQAADgIAAgELIAMpAwghBAsgASAENwMAQQEhAAwBCyACIAM1AgxCIIZCACADMQAIIgRQGyAEhDcCAEEAIQALIANBEGokgICAgAAgAAtcAQF/I4CAgIAAQRBrIgMkgICAgAAgACABKAIAIAEoAgQgA0EEahCMgICAAAJAIAMtAARBAUciAQ0AIAIgAy0ACDoAACACIAMoAgw2AgQLIANBEGokgICAgAAgAQtSAQF/I4CAgIAAQRBrIgIkgICAgAAgACACQQRqEI2AgIAAAkAgAi0ABEEBRyIADQAgASACLQAIOgAAIAEgAigCDDYCBAsgAkEQaiSAgICAACAACwoAIAAQjoCAgAALCAAQj4CAgAALCAAQkICAgAALCAAQkYCAgAALQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQkoCAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQk4CAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQlICAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLCAAQlYCAgAALCgAgABCWgICAAAtDAQF/I4CAgIAAQRBrIgEkgICAgAAgARCXgICAACAAQQA2AgwgACABKAIINgIIIAAgASkDADcDACABQRBqJICAgIAACwgAEIeCgIAAC7ICAQN/I4CAgIAAQSBrIgAkgICAgAACQAJAAkBBAUEYEIKCgIAAIgENACOOgICAAEEwNgIADAELIAAgATYCGCAAI4GAgIAAQYyAwYAAajYCHCAAIAApAhg3AxBBfyEBIABBEGoQt4GAgABBAEgNAQJAQQFBGBCCgoCAACICDQAjjoCAgABBMDYCAAwCCyACQQE2AgQgACACNgIYIAAjgYCAgABBjIDBgABqNgIcIAAgACkCGDcDCCAAQQhqELeBgIAAQQBIDQECQEEBQRgQgoKAgAAiAQ0AI46AgIAAQTA2AgAMAQsgAUECNgIEIAAgATYCGCAAI4GAgIAAQYyAwYAAajYCHCAAIAApAhg3AwBBACEBIAAQt4GAgABBf0oNAQtBfyEBCyAAQSBqJICAgIAAIAELYAEBfwJAIAAoAhAiAUUNACABEL+BgIAACwJAIAAoAhQiAUUNACABEL+BgIAACwJAIAAoAggiAUUNACABEMKBgIAACwJAIAAoAgwiAUUNACABEMSBgIAACyAAEICCgIAAC2gBAX8CQCAAKAIERQ0AI46AgIAAQTo2AgBBfw8LAkAgACgCCCICDQAgABDRgYCAACICNgIICyACEMOBgIAAIQIgASAAQRBqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEAC4IBAQF/AkAgACgCDCICDQACQAJAAkACQCAAKAIEQX9qDgICAAELENOBgIAAIQIMAgsjjoCAgABBOjYCAEF/DwsQ0oGAgAAhAgsgACACNgIMCyACEMWBgIAAIQIgASAAQRRqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEACw4AIAFBAEGQAfwLAEEACxMAQYCAgIABQYCAgCAgACgCBBsLqAEBAX8jgICAgABBEGsiASSAgICAAAJAAkACQAJAAkAgACgCBA4DAAECAwsgAUEMahDUgYCAAEUNAiABKAIMEMaBgIAAQQEhAAwDCyABQQhqENWBgIAARQ0BIAEoAggQx4GAgABBASEADAILIAFBBGoQ1oGAgABFDQAgASgCBBDHgYCAAEEBIQAMAQsjjoCAgABBOzYCAEEAIQALIAFBEGokgICAgAAgAAubAQEEfxCzgYCAAEEAIQECQCAAQT0Q8IGAgAAiAiAARg0AIAAgAiAAayIDai0AACECI5OAgIAAIQQgAg0AIAQoAgAiBEUNACAEKAIAIgJFDQAgBEEEaiEEAkADQAJAIAAgAiADEPmBgIAADQAgAiADaiICLQAAQT1GDQILIAQoAgAhAiAEQQRqIQQgAg0ADAILCyACQQFqIQELIAELfAECfyAAQQA2AjggACOUgICAACIBQQAgARs2AjAgACABI5WAgIAAa0EAIAEbIgE2AjQgACOBgICAACICQeyCwYAAaigCADYCDCACQeiAwYAAaiABQYCAgAQgAUGAgIAESRs2AgAgACAANgIAIAAgADYCCCAAIAA2AgRBAAsCAAv5AQEDfwJAI5aAgIAAIgIgAigCAEYNACOWgICAABDjgYCAABoLAkAjloCAgAAoAkQNACOBgICAACECI5aAgIAAIAJB8ILBgABqNgJECyOBgICAACICQfCGwYAAahDvgYCAABogASOCgICAAEHNgICAAGogARshAyACQZCHwYAAaigCACIEIQECQANAAkAjgYCAgABBoIfBgABqIAFBAnRqIgIoAgANACAAIAE2AgAgAiADNgIAI4GAgIAAQZCHwYAAaiABNgIAQQAhAQwCCyABQQFqQf8AcSIBIARHDQALQQYhAQsjgYCAgABB8IbBgABqEOyBgIAAGiABCwIAC6EBAQJ/AkAjloCAgAAiASABKAIARg0AI5aAgIAAEOOBgIAAGgsjgYCAgABB8IbBgABqEO+BgIAAGhDkgYCAACOWgICAACEBIABBAnQhAgNAIAEoAkQgAmpBADYCACABKAIIIgEjloCAgABHDQALI4GAgIAAIQEQ5IGAgAAgAUGgh8GAAGogAEECdGpBADYCACABQfCGwYAAahDsgYCAABpBAAtcAQF/AkAjloCAgAAiAiACKAIARg0AI5aAgIAAEOOBgIAAGgsCQCOWgICAACgCRCAAQQJ0aiIAKAIAIAFGDQAgACABNgIAI5aAgIAAIgEgAS0AJkEBcjoAJgtBAAtZAQF/QRwhAgJAIABBAksNAAJAI5aAgIAA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aq2ENwMgI4GAgIAAQdeBwIAAaiAIQSBqIAcQm4KAgAAAC+cCBQJ/An4BfwF+An8jgICAgABBIGsiAiSAgICAAEEUIQMgACkDACIEIQUCQCAEQugHVA0AQRQhAyAEIQUDQCACQQxqIANqIgBBfGojgYCAgABBoezAgABqIgYgBSIHIAdCkM4AgCIFQpDOAH59pyIIQf//A3FB5ABuIglBAXRqLwAAOwAAIABBfmogBiAIIAlB5ABsa0H//wNxQQF0ai8AADsAACADQXxqIQMgB0L/rOIEVg0ACwsCQCAFQglYDQAgAkEMaiADQX5qIgNqI4GAgIAAQaHswIAAaiAFpyIAIABB//8DcUHkAG4iAEHkAGxrQf//A3FBAXRqLwAAOwAAIACtIQULAkACQCAEUA0AIAVQDQELIAJBDGogA0F/aiIDaiOBgICAAEGh7MCAAGogBadBAXRqLQABOgAACyABQQFBAUEAIAJBDGogA2pBFCADaxCfgoCAACEDIAJBIGokgICAgAAgAwsUACABIAAoAgAgACgCBBCigoCAAAv0BAEIfyOAgICAAEEQayIEJICAgIAAAkACQAJAIANBAXENACACLQAAIgUNAUEAIQUMAgsgACACIANBAXYgASgCDBGEgICAAICAgIAAIQUMAQsgASgCDCEGQQAhBwNAIAJBAWohCAJAAkACQAJAAkAgBcBBf0oNACAFQf8BcSIJQYABRg0BIAlBwAFHDQMgBCABNgIEIAQgADYCACAEQqCAgIAGNwIIIAMgB0EDdGoiBSgCACAEIAUoAgQRgICAgACAgICAAEUNAkEBIQUMBgsCQCAAIAggBUH/AXEiBSAGEYSAgIAAgICAgAANACAIIAVqIQIMBAtBASEFDAULAkAgACACQQNqIgUgAi8AASICIAYRhICAgACAgICAAA0AIAUgAmohAgwDC0EBIQUMBAsgB0EBaiEHIAghAgwBC0GggICABiEKAkAgBUEBcUUNACACQQVqIQggAigAASEKC0EAIQkCQAJAIAVBAnENAEEAIQsgCCECDAELIAhBAmohAiAILwAAIQsLAkACQCAFQQRxDQAgAiEIDAELIAJBAmohCCACLwAAIQkLAkACQCAFQQhxDQAgCCECDAELIAhBAmohAiAILwAAIQcLAkAgBUEQcUUNACADIAtB//8DcUEDdGovAQQh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IGVuY29kZTogwADAAjogwADVpo4rCtiNo6y0ZkZZPt4+KtKXo9pGTSemv3LK9by33UvUG+1/zOs+vugSLqsPYvdCowAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL2lvL2Vycm9yL3VuaXgucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9zdGQvc3JjL3N5cy90aHJlYWRfbG9jYWwvZGVzdHJ1Y3RvcnMvbGlzdC5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2FsbG9jL3NyYy9mbXQucnMAL2hvbWUvbGFiLy5jYXJnby9yZWdpc3RyeS9zcmMvaW5kZXguY3JhdGVzLmlvLTE5NDljZjhjNmI1YjU1N2YvcXJjb2RlLTAuMTQuMS9zcmMvYml0cy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvbXV0ZXgvbm9fdGhyZWFkcy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvcndsb2NrL25vX3RocmVhZHMucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL29uY2Uvbm9fdGhyZWFkcy5ycwAvaG9tZS9sYWIvLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9xcmNvZGUtMC4xNC4xL3NyYy9jYW52YXMucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9ic3RyL21vZC5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjL21vZC5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2lkLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UvcmVwcl9pb3ZlYy5ycwAvaG9tZS9sYWIvLmNhcmdvL3JlZ2lzdHJ5L3NyYy9pbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zi9xcmNvZGUtMC4xNC4xL3NyYy9lYy5ycwBwYWNrYWdlcy93YXNtL3FyL3NyYy9saWIucnMALwAVYGF0YCBzcGxpdCBpbmRleCAoaXMgwBcpIHNob3VsZCBiZSA8PSBsZW4gKGlzIMABKQAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwEcgYnl0ZXMgZmFpbGVkCnNraXBwaW5nIGJhY2t0cmFjZSBwcmludGluZyB0byBhdm9pZCBwb3RlbnRpYWwgcmVjdXJzaW9uCgA1ZmF0YWwgcnVudGltZSBlcnJvcjogZmFpbGVkIHRvIGluaXRpYXRlIHBhbmljLCBlcnJvciDACywgYWJvcnRpbmcKABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDADiBieXRlcyBmYWlsZWQKAAxwYW5pY2tlZCBhdCDAAjoKwDMKdGhyZWFkIHBhbmlja2VkIHdoaWxlIHByb2Nlc3NpbmcgcGFuaWMuIGFib3J0aW5nLgoACQp0aHJlYWQgJ8AD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dW5yZWFjaGFibGUgY29kZTogaW52YWxpZCBPbmNlIHN0YXRlZmF0YWwgcnVudGltZSBlcnJvcjogYXNzZXJ0aW9uIGZhaWxlZDoga2V5IGFzIHVzaXplICE9IEtFWV9TRU5UVkFMLCBhYm9ydGluZwpmYXRhbCBydW50aW1lIGVycm9yOiByd2xvY2sgbG9ja2VkIGZvciB3cml0aW5nLCBhYm9ydGluZwpyd2xvY2sgb3ZlcmZsb3dlZCByZWFkIGxvY2tzUlVTVF9CQUNLVFJBQ0VjYW5ub3QgcmVjdXJzaXZlbHkgYWNxdWlyZSBtdXRleGFkdmFuY2luZyBJb1NsaWNlIGJleW9uZCBpdHMgbGVuZ3RoYWR2YW5jaW5nIGlvIHNsaWNlcyBiZXlvbmQgdGhlaXIgbGVuZ3RoQm94PGR5biBBbnk+dGhyZWFkIGNhdXNlZCBub24tdW53aW5kaW5nIHBhbmljLiBhYm9ydGluZy4KZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcnN0YWNrIGJhY2t0cmFjZToKbm90ZTogU29tZSBkZXRhaWxzIGFyZSBvbWl0dGVkLCBydW4gd2l0aCBgUlVTVF9CQUNLVFJBQ0U9ZnVsbGAgZm9yIGEgdmVyYm9zZSBiYWNrdHJhY2UuCmZhdGFsIHJ1bnRpbWUgZXJyb3I6IHRoZSBTeXN0ZW0gYWxsb2NhdG9yIG1heSBub3QgdXNlIFRMUyB3aXRoIGRlc3RydWN0b3JzLCBhYm9ydGluZwpmYXRhbCBydW50aW1lIGVycm9yOiBVbmV4cGVjdGVkIFRMUyBmYWlsdXJlLCBhYm9ydGluZwpmYXRhbCBydW50aW1lIGVycm9yOiBvdXQgb2YgVExTIGtleXMsIGFib3J0aW5nCnN0cmVycm9yX3IgZmFpbHVyZWZhaWxlZCB0byBnZW5lcmF0ZSB1bmlxdWUgdGhyZWFkIElEOiBiaXRzcGFjZSBleGhhdXN0ZWRyd2xvY2sgaGFzIG5vdCBiZWVuIGxvY2tlZCBmb3IgcmVhZGluZyIBCAkrDSsrKxwrKwYCAx4rKxoMKxsEKysnIxQpKw8SKCArKyEKKwUoKysAKysrJisrGCQHDhArKyQrKysrAQsrKysrERkrExYdHwEAAAAAAAAAU3VjY2VzcwBJbGxlZ2FsIGJ5dGUgc2VxdWVuY2UARG9tYWluIGVycm9yAFJlc3VsdCBub3QgcmVwcmVzZW50YWJsZQBOb3QgYSB0dHkAUGVybWlzc2lvbiBkZW5pZWQAT3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWQATm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQBObyBzdWNoIHByb2Nlc3MARmlsZSBleGlzdHMAVmFsdWUgdG9vIGxhcmdlIGZvciBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFF1b3RhIGV4Y2VlZGVkAE11bHRpaG9wIGF0dGVtcHRlZABDYXBhYmlsaXRpZXMgaW5zdWZmaWNpZW50AAAAAAAAAAAAAAAAAAAAdQJOANYB4gS5BBgBjgXtAhYE8gCXAwEDOAWvAYIBTwMvBB4A1AWiABIDHgPCAd4DCACsBQABZALxAWUFNAKMAs8CLQNMBOMFnwL4BBwFCAWxAksFFQJ4AFICPAPxA+QAwwN9BMwAqgN5BSQCbgFtAyIEqwREAPsBrgCDA2AA5QEHBJQEXgQrAFgBOQGSAMIFmwFDAkYB9gVjYXBhY2l0eSBvdmVyZmxvd2EgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVh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");
		Promise.resolve(module0).catch(() => {});
		let module1 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABFwRgA39/fwBgAn9/AGAEf39/fwBgAX8AAwoJAAECAQMDAwMDBAUBcAEJCQcwCgEwAAABMQABATIAAgEzAAMBNAAEATUABQE2AAYBNwAHATgACAgkaW1wb3J0cwEACmkJDQAgACABIAJBABEAAAsLACAAIAFBAREBAAsPACAAIAEgAiADQQIRAgALCwAgACABQQMRAQALCQAgAEEEEQMACwkAIABBBREDAAsJACAAQQYRAwALCQAgAEEHEQMACwkAIABBCBEDAAsALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1Ny4x");
		Promise.resolve(module1).catch(() => {});
		let module2 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABGgVgA39/fwBgAn9/AGAEf39/fwBgAX8AYAAAAooBCwZhY3R1YWwBMAAABmFjdHVhbAExAAEGYWN0dWFsATIAAgZhY3R1YWwBMwABBmFjdHVhbAE0AAMGYWN0dWFsATUAAwZhY3R1YWwBNgADBmFjdHVhbAE3AAMGYWN0dWFsATgAAwRtYWluC19pbml0aWFsaXplAAQEc2hpbQgkaW1wb3J0cwFwAQkJCAEJCQ8BAEEACwkAAQIDBAUGBwgALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI1Ny4x");
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
				"wasi:cli/environment@0.2.12": { "get-environment": Object.assign(exports0[4], { _jcoMaySuspend: !1 }) },
				"wasi:cli/exit@0.2.12": {
					exit: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline6, !1), { _jcoMaySuspend: !1 }),
					"exit-with-code": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline7, !1), { _jcoMaySuspend: !1 })
				},
				"wasi:cli/stderr@0.2.12": { "get-stderr": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline12, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/stdin@0.2.12": { "get-stdin": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline10, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/stdout@0.2.12": { "get-stdout": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline11, !1), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-input@0.2.12": { "[resource-drop]terminal-input": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline4), !0), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-output@0.2.12": { "[resource-drop]terminal-output": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline5), !0), { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stderr@0.2.12": { "get-terminal-stderr": Object.assign(exports0[7], { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stdin@0.2.12": { "get-terminal-stdin": Object.assign(exports0[5], { _jcoMaySuspend: !1 }) },
				"wasi:cli/terminal-stdout@0.2.12": { "get-terminal-stdout": Object.assign(exports0[6], { _jcoMaySuspend: !1 }) },
				"wasi:clocks/monotonic-clock@0.2.12": {
					now: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline13, !1), { _jcoMaySuspend: !1 }),
					"subscribe-duration": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline14, !1), { _jcoMaySuspend: !1 })
				},
				"wasi:clocks/wall-clock@0.2.12": { now: Object.assign(exports0[8], { _jcoMaySuspend: !1 }) },
				"wasi:io/error@0.2.12": { "[resource-drop]error": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline0), !0), { _jcoMaySuspend: !1 }) },
				"wasi:io/poll@0.2.12": {
					"[method]pollable.block": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline8, !1), { _jcoMaySuspend: !1 }),
					"[resource-drop]pollable": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, _guardMayLeave(_jcoComponentMayLeaveContext, 0, trampoline1), !0), { _jcoMaySuspend: !1 }),
					poll: Object.assign(exports0[0], { _jcoMaySuspend: !1 })
				},
				"wasi:io/streams@0.2.12": {
					"[method]output-stream.blocking-flush": Object.assign(exports0[3], { _jcoMaySuspend: !1 }),
					"[method]output-stream.check-write": Object.assign(exports0[1], { _jcoMaySuspend: !1 }),
					"[method]output-stream.subscribe": Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline9, !1), { _jcoMaySuspend: !1 }),
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
					8: Object.assign(_guardTrap(_jcoComponentRecordTrapContext, 0, trampoline23, !1), { _jcoMaySuspend: !1 })
				},
				main: { _initialize: Object.assign(exports1._initialize, { _jcoMaySuspend: !1 }) },
				shim: { $imports: exports0.$imports }
			})));
			postReturn0 = exports1.cabi_post_encode;
			try {
				WebAssembly.promising(exports1.cabi_post_encode);
			} catch {
				exports1.cabi_post_encode;
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
		exports1Encode = exports1.encode;
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
export { encode };
export const _util = {
	stop: _stopInstance.bind(void 0, _jcoComponentStopContext),
	whenIdle: _whenIdle.bind(void 0, _jcoComponentIdleContext),
	isComponentError: (value) => value instanceof ComponentError
};
