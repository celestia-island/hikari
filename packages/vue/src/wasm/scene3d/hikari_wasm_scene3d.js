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
let exports1BuildFleetScene;
function buildFleetScene(arg0) {
	getOrCreateAsyncState(_jcoComponentStateLookupContext, 0).throwIfTrapped();
	let { task, threadID } = createNewCurrentImplicitThread(_jcoTaskCreateContext, {
		componentIdx: 0,
		isAsync: !1,
		isManualAsync: !1,
		preserveFutureResult: !1,
		entryFnName: "exports1BuildFleetScene",
		getCallbackFn: () => null,
		callbackFnName: null,
		errHandling: "none",
		callingWasmExport: !0
	});
	task.setCalleeIsAsync(!1);
	task.setFuncTypeIsAsync(!1);
	task.setReturnResultTypeIdx(23);
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
				var vec9 = arg0;
				var len9 = vec9.length;
				var result9 = ((...args) => {
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
				})(0, 0, 4, len9 * 56);
				result9 >>>= 0;
				if (result9 % 4 != 0) throw new WebAssemblyRuntimeError("realloc return: result not aligned");
				if (result9 > memory0.buffer.byteLength || len9 > Math.floor((memory0.buffer.byteLength - result9) / 56)) throw new WebAssemblyRuntimeError("realloc return: beyond end of memory");
				if (result9 < 0 || len9 < 0 || len9 > 4793490 || result9 > memory0.buffer.byteLength || len9 > Math.floor((memory0.buffer.byteLength - result9) / 56)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
				for (let i = 0; i < vec9.length; i++) {
					let e = vec9[i];
					let base = result9 + i * 56;
					var { nodeId: v0_0, tier: v0_1, stationCount: v0_2, label: v0_3, status: v0_4, online: v0_5, detail: v0_6 } = e;
					var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, v0_0, ((...args) => {
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
					dataView(_jcoDataViewCacheContext, memory0).setInt32(base + 8, toUint32(_jcoStrictNumericContext, v0_1), !0);
					dataView(_jcoDataViewCacheContext, memory0).setInt32(base + 12, toUint32(_jcoStrictNumericContext, v0_2), !0);
					var variant3 = v0_3;
					if (variant3 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 16, 0, !0);
					else {
						let e = variant3;
						dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 16, 1, !0);
						var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, e, ((...args) => {
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
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 24, len2, !0);
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 20, ptr2, !0);
					}
					var variant5 = v0_4;
					if (variant5 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 28, 0, !0);
					else {
						let e = variant5;
						dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 28, 1, !0);
						var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, e, ((...args) => {
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
						var ptr4 = encodeRes.ptr;
						var len4 = encodeRes.len;
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 36, len4, !0);
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 32, ptr4, !0);
					}
					var variant6 = v0_5;
					if (variant6 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 40, 0, !0);
					else {
						let e = variant6;
						dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 40, 1, !0);
						dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 41, +!!e, !0);
					}
					var variant8 = v0_6;
					if (variant8 == null) dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 44, 0, !0);
					else {
						let e = variant8;
						dataView(_jcoDataViewCacheContext, memory0).setInt8(base + 44, 1, !0);
						var encodeRes = _utf8AllocateAndEncode(TEXT_ENCODER_UTF8, e, ((...args) => {
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
						var ptr7 = encodeRes.ptr;
						var len7 = encodeRes.len;
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 52, len7, !0);
						dataView(_jcoDataViewCacheContext, memory0).setUint32(base + 48, ptr7, !0);
					}
				}
				_debugLog("[iface=\"build-fleet-scene\", function=\"build-fleet-scene\"][Instruction::CallWasm] enter", {
					funcName: "build-fleet-scene",
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
						fn: () => exports1BuildFleetScene(result9, len9)
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
				var len16 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 4, !0);
				var base16 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 0, !0) >>> 0;
				if (base16 < 0 || len16 < 0 || len16 > 2684354 || base16 > memory0.buffer.byteLength || len16 > Math.floor((memory0.buffer.byteLength - base16) / 100)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
				if (base16 % 4 != 0) throw TypeError(`list pointer [${base16}] is not aligned to 4`);
				var result16 = [];
				for (let i = 0; i < len16; i++) {
					let base = base16 + i * 100;
					var ptr10 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 0, !0) >>> 0;
					var len10 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 4, !0) >>> 0;
					if (ptr10 > memory0.buffer.byteLength || len10 > Math.floor((memory0.buffer.byteLength - ptr10) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result10 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr10, len10));
					var ptr11 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 8, !0) >>> 0;
					var len11 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 12, !0) >>> 0;
					if (ptr11 > memory0.buffer.byteLength || len11 > Math.floor((memory0.buffer.byteLength - ptr11) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result11 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr11, len11));
					var ptr12 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 16, !0) >>> 0;
					var len12 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 20, !0) >>> 0;
					if (ptr12 > memory0.buffer.byteLength || len12 > Math.floor((memory0.buffer.byteLength - ptr12) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result12 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr12, len12));
					var bool13 = dataView(_jcoDataViewCacheContext, memory0).getUint8(base + 24, !0);
					var ptr14 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 28, !0) >>> 0;
					var len14 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 32, !0) >>> 0;
					if (ptr14 > memory0.buffer.byteLength || len14 > Math.floor((memory0.buffer.byteLength - ptr14) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result14 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr14, len14));
					var ptr15 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 36, !0) >>> 0;
					var len15 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 40, !0) >>> 0;
					if (ptr15 > memory0.buffer.byteLength || len15 > Math.floor((memory0.buffer.byteLength - ptr15) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result15 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr15, len15));
					result16.push({
						id: result10,
						label: result11,
						status: result12,
						online: bool13 == 0 ? !1 : bool13 == 1 || throwInvalidBool(),
						detail: result14,
						role: result15,
						color: [
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 44, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 48, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 52, !0)
						],
						radius: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 56, !0),
						orbitCenter: [
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 60, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 64, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 68, !0)
						],
						orbitRadius: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 72, !0),
						orbitPeriodSec: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 76, !0),
						orbitPhase: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 80, !0),
						orbitTilt: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 84, !0),
						spinPeriodSec: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 88, !0),
						satellites: dataView(_jcoDataViewCacheContext, memory0).getInt32(base + 92, !0) >>> 0,
						satelliteTotal: dataView(_jcoDataViewCacheContext, memory0).getInt32(base + 96, !0) >>> 0
					});
				}
				var len23 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 12, !0);
				var base23 = dataView(_jcoDataViewCacheContext, memory0).getUint32((ret >>> 0) + 8, !0) >>> 0;
				if (base23 < 0 || len23 < 0 || len23 > 2684354 || base23 > memory0.buffer.byteLength || len23 > Math.floor((memory0.buffer.byteLength - base23) / 100)) throw new WebAssemblyRuntimeError("wasm trap: out of bounds memory access");
				if (base23 % 4 != 0) throw TypeError(`list pointer [${base23}] is not aligned to 4`);
				var result23 = [];
				for (let i = 0; i < len23; i++) {
					let base = base23 + i * 100;
					var ptr17 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 0, !0) >>> 0;
					var len17 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 4, !0) >>> 0;
					if (ptr17 > memory0.buffer.byteLength || len17 > Math.floor((memory0.buffer.byteLength - ptr17) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result17 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr17, len17));
					var ptr18 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 8, !0) >>> 0;
					var len18 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 12, !0) >>> 0;
					if (ptr18 > memory0.buffer.byteLength || len18 > Math.floor((memory0.buffer.byteLength - ptr18) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result18 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr18, len18));
					var ptr19 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 16, !0) >>> 0;
					var len19 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 20, !0) >>> 0;
					if (ptr19 > memory0.buffer.byteLength || len19 > Math.floor((memory0.buffer.byteLength - ptr19) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result19 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr19, len19));
					var bool20 = dataView(_jcoDataViewCacheContext, memory0).getUint8(base + 24, !0);
					var ptr21 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 28, !0) >>> 0;
					var len21 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 32, !0) >>> 0;
					if (ptr21 > memory0.buffer.byteLength || len21 > Math.floor((memory0.buffer.byteLength - ptr21) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result21 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr21, len21));
					var ptr22 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 36, !0) >>> 0;
					var len22 = dataView(_jcoDataViewCacheContext, memory0).getUint32(base + 40, !0) >>> 0;
					if (ptr22 > memory0.buffer.byteLength || len22 > Math.floor((memory0.buffer.byteLength - ptr22) / 1)) throw new WebAssemblyRuntimeError("string pointer/length out of bounds of memory");
					var result22 = _decodeUtf8(WebAssemblyRuntimeError, TEXT_DECODER_UTF8, new Uint8Array(memory0.buffer, ptr22, len22));
					result23.push({
						id: result17,
						label: result18,
						status: result19,
						online: bool20 == 0 ? !1 : bool20 == 1 || throwInvalidBool(),
						detail: result21,
						role: result22,
						color: [
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 44, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 48, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 52, !0)
						],
						radius: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 56, !0),
						orbitCenter: [
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 60, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 64, !0),
							dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 68, !0)
						],
						orbitRadius: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 72, !0),
						orbitPeriodSec: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 76, !0),
						orbitPhase: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 80, !0),
						orbitTilt: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 84, !0),
						spinPeriodSec: dataView(_jcoDataViewCacheContext, memory0).getFloat32(base + 88, !0),
						satellites: dataView(_jcoDataViewCacheContext, memory0).getInt32(base + 92, !0) >>> 0,
						satelliteTotal: dataView(_jcoDataViewCacheContext, memory0).getInt32(base + 96, !0) >>> 0
					});
				}
				var bool24 = dataView(_jcoDataViewCacheContext, memory0).getUint8((ret >>> 0) + 16, !0);
				_debugLog("[iface=\"build-fleet-scene\", function=\"build-fleet-scene\"][Instruction::Return]", {
					funcName: "build-fleet-scene",
					paramCount: 1,
					async: !1,
					postReturn: !0
				});
				task.resolve([{
					stars: result16,
					planets: result23,
					hasRegistryCore: bool24 == 0 ? !1 : bool24 == 1 || throwInvalidBool()
				}]);
				let retCopy = {
					stars: result16,
					planets: result23,
					hasRegistryCore: bool24 == 0 ? !1 : bool24 == 1 || throwInvalidBool()
				};
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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABvQEdYAJ/fwBgBH9/f38AYAN/f38Bf2ABfwF/YAJ/fwF/YAF/AGAGf39/f39/AX9gA39/fwBgAAF/YAABfmABfgF/YAAAYAV/f39/fwBgA35+fwF+YAZ/f39/f38AYAR/f39/AX9gB39/f39/f38AYAN/f3wAYAJ/fgF/YAV/f39/fwF/YAJ8fAF8YAJ8fwF/YAN8fH8BfGABfAF8YAJ/fAF8YAF/AXxgA3x+fgF8YAJ8fwF8YAh/f39/f39/fwACpQkZIHdhc2k6cmFuZG9tL2luc2VjdXJlLXNlZWRAMC4yLjEyDWluc2VjdXJlLXNlZWQABRR3YXNpOmlvL2Vycm9yQDAuMi4xMhRbcmVzb3VyY2UtZHJvcF1lcnJvcgAFE3dhc2k6aW8vcG9sbEAwLjIuMTIXW3Jlc291cmNlLWRyb3BdcG9sbGFibGUABRZ3YXNpOmlvL3N0cmVhbXNAMC4yLjEyG1tyZXNvdXJjZS1kcm9wXWlucHV0LXN0cmVhbQAFFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIcW3Jlc291cmNlLWRyb3Bdb3V0cHV0LXN0cmVhbQAFHndhc2k6Y2xpL3Rlcm1pbmFsLWlucHV0QDAuMi4xMh1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAFH3dhc2k6Y2xpL3Rlcm1pbmFsLW91dHB1dEAwLjIuMTIeW3Jlc291cmNlLWRyb3BddGVybWluYWwtb3V0cHV0AAUbd2FzaTpjbGkvZW52aXJvbm1lbnRAMC4yLjEyD2dldC1lbnZpcm9ubWVudAAFFHdhc2k6Y2xpL2V4aXRAMC4yLjEyBGV4aXQABRR3YXNpOmNsaS9leGl0QDAuMi4xMg5leGl0LXdpdGgtY29kZQAFE3dhc2k6aW8vcG9sbEAwLjIuMTIWW21ldGhvZF1wb2xsYWJsZS5ibG9jawAFE3dhc2k6aW8vcG9sbEAwLjIuMTIEcG9sbAAHFndhc2k6aW8vc3RyZWFtc0AwLjIuMTIhW21ldGhvZF1vdXRwdXQtc3RyZWFtLmNoZWNrLXdyaXRlAAAWd2FzaTppby9zdHJlYW1zQDAuMi4xMhtbbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUAARZ3YXNpOmlvL3N0cmVhbXNAMC4yLjEyJFtt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IAhBfHEhDSAJIBNqIRBBACEOA0AgCiAQKAIANgIAIApBBGogFyAOQf7///8Dc0ECdGooAgA2AgAgCkEIaiAXIA5B/f///wNzQQJ0aigCADYCACAKQQxqIBcgDkH8////A3NBAnRqKAIANgIAIBBBcGohECAKQRBqIQogDSAOQQRqIg5HDQALIBFFDQELIAkgDkECdCIOayATaiEKIAAgDmogD2ohDgNAIA4gCigCADYCACAKQXxqIQogDkEEaiEOIBFBf2oiEQ0ACwsCQCALIAFLDQAgACAPaiEAQQAhBSAIIQEgCEEhSQ0EDAELCyALIAEgASOBgICAAEGokMGAAGoQl4KAgAAACyOBgICAACIKQfiTwIAAakETIApBmJDBgABqEJaCgIAADAILIAAgASACIANBASAGEKCAgIAADAILIAhBAkkNASADIAhBEGpJDQAgCEEBdiETAkACQAJAIAhBD0sNACAIQQdNDQEgACACEKSAgIAAIAAgE0ECdCIKaiACIApqEKSAgIAAQQQhFwwCCyAAIAIgCEECdGoiChCkgICAACAAQRBqIApBEGoQpICAgABBCCEXIApBCCACEKWAgIAAIAAgE0ECdCIOaiIRIApBIGoiCxCkgICAACARQRBqIApBMGoQpICAgAAgC0EIIAIgDmoQpYCAgAAMAQsgAiAAKAIANgIAIAIgE0ECdCIKaiAAIApqKAIANgIAQQEhFwsgCCATayEMAkAgFyATTw0AIBdBAnQhASAXIRIDQCACIBJBAnQiCmoiCyAAIApqKAIAIhg2AgACQCAYKAIEIg8gC0F8aigCACIRKAIEIBgoAggiCiARKAIIIg4gCiAOSRsQ8YGAgAAiECAKIA5rIBAbQX9KDQAgCyARNgIAIAEhDiACIRACQCASQQFGDQADQCACIA5qIhFBfGohECAPIBFBeGooAgAiCygCBCAKIAsoAggiESAKIBFJGxDxgYCAACINIAogEWsgDRtBAE4NASAQIAs2AgAgDkF8aiIOQQRHDQALIAIhEAsgECAYNgIACyABQQRqIQEgEkEBaiISIBNHDQALCwJAIBcgDE8NACAAIBNBAnQiCmohBCAXQQJ0IRJBBCETIAIgCmoiFCEWA0AgFCAXQQJ0IgpqIgsgBCAKaigCACIBNgIAAkAgASgCBCIYIAtBfGooAgAiESgCBCABKAIIIgogESgCCCIOIAogDkkbEPGBgIAAIhAgCiAOayAQG0F/Sg0AIAsgETYCACATIQ0gFiEOIBQhEAJAIBdBAUYNAANAIA4gEmoiEUF8aiEQIBggEUF4aigCACILKAIEIAogCygCCCIRIAogEUkbEPGBgIAAIg8gCiARayAPG0EATg0BIBAgCzYCACAOQXxqIQ4gEiANQQRqIg1HDQALIBQhEAsgECABNgIACyATQXxqIRMgFkEEaiEWIBdBAWoiFyAMRw0ACwsgAiAIIAAQpYCAgAAMAQsACyAHQRBqJICAgIAAC/QXARJ/I4CAgIAAQRBrIgckgICAgAACQAJAAkACQCABQSFPDQAgASEIDAELIAJBfGohCQJAAkADQCAERQ0CA0AgACABQQN2IgpBHGxqIQggACAKQQR0aiELAkACQCABQcAASQ0AIAAgCyAIIAoQo4CAgAAhDAwBCyAAKAIAIgooAgQiDSALKAIAIg4oAgQiDyAKKAIIIgogDigCCCIOIAogDkkbEPGBgIAAIRAgACEMIA0gCCgCACIRKAIEIhIgCiARKAIIIhEgCiARSRsQ8YGAgAAiDSAKIBFrIA0bIBAgCiAOayAQGyIKc0EASA0AIAggCyAPIBIgDiARIA4gEUkbEPGBgIAAIhAgDiARayAQGyAKc0EASBshDAsgBEF/aiEEIAcgDCgCACITNgIMIAwgAGtBAnYhFAJAAkAgBUUNACAFKAIAIgooAgQgEygCBCAKKAIIIgogEygCCCIOIAogDkkbEPGBgIAAIhEgCiAOayARG0F/Sg0BCyADIAFJDQZBACEIIAAhDiACIAFBAnQiFWoiFiERIBQhFwNAAkAgDiAAQQAgF0F9aiIKIAogF0sbQQJ0aiIYTw0AIBMoAgghCiATKAIEIQsDQCACIBFBfGogDigCACIQKAIEIAsgECgCCCINIAogDSAKSRsQ8YGAgAAiDyANIAprIA8bIg9BAEgbIAhBAnRqIBA2AgAgAiARQXhqIA5BBGooAgAiECgCBCALIBAoAggiDSAKIA0gCkkbEPGBgIAAIhIgDSAKayASGyINQQBIGyAPQR92IAhqIg9BAnRqIBA2AgAgAiARQXRqIA5BCGooAgAiCCgCBCALIAgoAggiECAKIBAgCkkbEPGBgIAAIhIgECAKayASGyISQQBIGyANQR92IA9qIg1BAnRqIAg2AgAgAiARQXBqIhEgDkEMaigCACIIKAIEIAsgCCgCCCIQIAogECAKSRsQ8YGAgAAiDyAQIAprIA8bIhBBAEgbIBJBH3YgDWoiDUECdGogCDYCACAQQR92IA1qIQggDkEQaiIOIBhJDQALCwJAIA4gACAXQQJ0aiIPTw0AIBMoAgghCiATKAIEIRIDQCACIBFBfGoiESAOKAIAIgsoAgQgEiALKAIIIhAgCiAQIApJGxDxgYCAACINIBAgCmsgDRsiEEEASBsgCEECdGogCzYCACAQQR92IAhqIQggDkEEaiIOIA9JDQALCwJAIBcgAUYNACARQXxqIhEgCEECdGogDigCADYCACAOQQRqIQ4gASEXDAELCwJAIAhBAnQiDUUNACAAIAIgDfwKAAALIAEgCGshDwJAIAEgCEYNACAPQQNxIRFBACEOAkAgCCABa0F8Sw0AIAAgDWohCiAPQXxxIRAgCSAVaiELQQAhDgNAIAogCygCADYCACAKQQRqIBYgDkH+////A3NBAnRqKAIANgIAIApBCGogFiAOQf3///8Dc0ECdGooAgA2AgAgCkEMaiAWIA5B/P///wNzQQJ0aigCADYCACALQXBqIQsgCkEQaiEKIBAgDkEEaiIORw0ACyARRQ0BCyAJIBUgDkECdCIOa2ohCiAAIA5qIA1qIQ4DQCAOIAooAgA2AgAgCkF8aiEKIA5BBGohDiARQX9qIhENAAsLIAhFDQAgCCABSw0DIAAgDWogDyACIAMgBCAHQQxqIAYQqICAgAAgCEEhSQ0FIAghASAERQ0EDAELCyADIAFJDQRBACELIAAhDiACIAFBAnQiE2oiFyERA0ACQCAOIABBACAUQX1qIgogCiAUSxtBAnRqIhhPDQAgDCgCACIIKAIIIQogCCgCBCEIA0AgAiARQXxqIAggDigCACIQKAIEIAogECgCCCINIAogDUkbEPGBgIAAIg8gCiANayAPG0F/SiIPGyALQQJ0aiAQNgIAIAIgEUF4aiAIIA5BBGooAgAiECgCBCAKIBAoAggiDSAKIA1JGxDxgYCAACISIAogDWsgEhtBf0oiDRsgCyAPaiIPQQJ0aiAQNgIAIAIgEUF0aiAIIA5BCGooAgAiCygCBCAKIAsoAggiECAKIBBJGxDxgYCAACISIAogEGsgEhtBf0oiEhsgDyANaiINQQJ0aiALNgIAIAIgEUFwaiIRIAggDkEMaigCACILKAIEIAogCygCCCIQIAogEEkbEPGBgIAAIg8gCiAQayAPG0F/SiIQGyANIBJqIg1BAnRqIAs2AgAgDSAQaiELIA5BEGoiDiAYSQ0ACwsCQCAOIAAgFEECdGoiD08NACAMKAIAIggoAgghCiAIKAIEIRIDQCACIBFBfGoiESASIA4oAgAiCCgCBCAKIAgoAggiECAKIBBJGxDxgYCAACINIAogEGsgDRtBf0oiEBsgC0ECdGogCDYCACALIBBqIQsgDkEEaiIOIA9JDQALCwJAIBQgAUYNACACIAtBAnRqIA4oAgA2AgAgDkEEaiEOIAtBAWohCyARQXxqIREgASEUDAELCwJAIAtBAnQiD0UNACAAIAIgD/wKAAALIAEgC0YNBSABIAtrIghBA3EhEUEAIQ4CQAJAIAsgAWtBfEsNACAAIA9qIQogCEF8cSENIAkgE2ohEEEAIQ4DQCAKIBAoAgA2AgAgCkEEaiAXIA5B/v///wNzQQJ0aigCADYCACAKQQhqIBcgDkH9////A3NBAnRqKAIANgIAIApBDGogFyAOQfz///8Dc0ECdGooAgA2AgAgEEFwaiEQIApBEGohCiANIA5BBGoiDkcNAAsgEUUNAQsgCSAOQQJ0Ig5rIBNqIQogACAOaiAPaiEOA0AgDiAKKAIANgIAIApBfGohCiAOQQRqIQ4gEUF/aiIRDQALCwJAIAsgAUsNACAAIA9qIQBBACEFIAghASAIQSFJDQQMAQsLIAsgASABI4GAgIAAQaiQwYAAahCXgoCAAAALI4GAgIAAIgpB+JPAgABqQRMgCkGYkMGAAGoQloKAgAAMAgsgACABIAIgA0EBIAYQooCAgAAMAgsgCEECSQ0BIAMgCEEQakkNACAIQQF2IRMCQAJAAkAgCEEPSw0AIAhBB00NASAAIAIQpICAgAAgACATQQJ0IgpqIAIgCmoQpICAgABBBCEXDAILIAAgAiAIQQJ0aiIKEKSAgIAAIABBEGogCkEQahCkgICAAEEIIRcgCkEIIAIQpYCAgAAgACATQQJ0Ig5qIhEgCkEgaiILEKSAgIAAIBFBEGogCkEwahCkgICAACALQQggAiAOahClgICAAAwBCyACIAAoAgA2AgAgAiATQQJ0IgpqIAAgCmooAgA2AgBBASEXCyAIIBNrIQwCQCAXIBNPDQAgF0ECdCEBIBchEgNAIAIgEkECdCIKaiILIAAgCmooAgAiGDYCAAJAIBgoAgQiDyALQXxqKAIAIhEoAgQgGCgCCCIKIBEoAggiDiAKIA5JGxDxgYCAACIQIAogDmsgEBtBf0oNACALIBE2AgAgASEOIAIhEAJAIBJBAUYNAANAIAIgDmoiEUF8aiEQIA8gEUF4aigCACILKAIEIAogCygCCCIRIAogEUkbEPGBgIAAIg0gCiARayANG0EATg0BIBAgCzYCACAOQXxqIg5BBEcNAAsgAiEQCyAQIBg2AgALIAFBBGohASASQQFqIhIgE0cNAAsLAkAgFyAMTw0AIAAgE0ECdCIKaiEEIBdBAnQhEkEEIRMgAiAKaiIUIRYDQCAUIBdBAnQiCmoiCyAEIApqKAIAIgE2AgACQCABKAIEIhggC0F8aigCACIRKAIEIAEoAggiCiARKAIIIg4gCiAOSRsQ8YGAgAAiECAKIA5rIBAbQX9KDQAgCyARNgIAIBMhDSAWIQ4gFCEQAkAgF0EBRg0AA0AgDiASaiIRQXxqIRAgGCARQXhqKAIAIgsoAgQgCiALKAIIIhEgCiARSRsQ8YGAgAAiDyAKIBFrIA8bQQBODQEgECALNgIAIA5BfGohDiASIA1BBGoiDUcNAAsgFCEQCyAQIAE2AgALIBNBfGohEyAWQQRqIRYgF0EBaiIXIAxHDQALCyACIAggABClgICAAAwBCwALIAdBEGokgICAgAALowEBAX8jgICAgABBEGsiBSSAgICAAAJAIAIgAWoiASACTw0AQQBBABCKgoCAAAALIAVBBGogACgCACICIAAoAgQgAkEBdCICIAEgAiABSxsiAkEEIAJBBEsbIgIgAyAEEKqAgIAAAkAgBSgCBEEBRw0AIAUoAgggBSgCDBCKgoCAAAALIAUoAgghASAAIAI2AgAgACABNgIEIAVBEGokgICAgAALtgECAn8BfkEBIQZBBCEHAkACQCAFrSADrX4iCEIgiKdFDQBBACEDDAELAkAgCKciA0GAgICAeCAEa00NAEEAIQMMAQsCQAJAAkACQCABRQ0AIAIgBSABbCAEIAMQt4CAgAAhBwwBCwJAIAMNACAEIQcMAgsQuYCAgAAgAyAEELWAgIAAIQcLIAcNACAAIAQ2AgQMAQsgACAHNgIEQQAhBgtBCCEHCyAAIAdqIAM2AgAgACAGNgIAC+oEAgV/Bn4gACAAKAI4IAJqNgI4AkACQCAAKAI8IgMNAEEAIQQMAQtBBCEFAkACQCACQQggA2siBCACIARJIgYbIgdBBE8NAEIAIQhBACEFDAELIAE1AAAhCAsCQCAFQQFyIAdPDQAgASAFajMAACAFQQN0rYYgCIQhCCAFQQJyIQULAkAgBSAHTw0AIAEgBWoxAAAgBUEDdK2GIAiEIQgLIAAgACkDMCAIIANBA3SthoQiCDcDMAJAIAYNACAAIAApAwggACkDGCAIhSIJfCIKIAApAxAiC0INiSALIAApAwB8IguFIgx8Ig0gDEIRiYU3AxAgACANQiCJNwMIIAAgCiAJQhCJhSIJQhWJIAkgC0IgiXwiCYU3AxggACAJIAiFNwMADAELIAAgAyACajYCPA8LIAIgBGsiAkEHcSEFAkAgBCACQXhxIgJPDQAgACkDCCEJIAApAxAhCCAAKQMYIQogACkDACELA0AgCSAKIAEgBGopAAAiDIUiCnwiCSAIQg2JIAggC3wiC4UiCHwiDSAIQhGJhSEIIAkgCkIQiYUiCUIViSAJIAtCIIl8IguFIQogDUIgiSEJIAsgDIUhCyAEQQhqIgQgAkkNAAsgACAINwMQIAAgCjcDGCAAIAk3AwggACALNwMAC0EEIQICQAJAIAVBBE8NAEIAIQhBACECDAELIAEgBGo1AAAhCAsCQCACQQFyIAVPDQAgASAEaiACajMAACACQQN0rYYgCIQhCCACQQJyIQILAkAgAiAFTw0AIAEgAiAEamoxAAAgAkEDdK2GIAiEIQgLIAAgCDcDMCAAIAU2AjwLrAcBB38gAiABIAJqayEDQQAhBAJAA0ACQCAEIgUgAkcNACACIQUMAgsCQAJAIAEgBWoiBCwAACIGQX9MDQAgBEEBaiEEIAZB/wFxIQYMAQsgBC0AAUE/cSEHIAZBH3EhCAJAIAZBX0sNACAIQQZ0IAdyIQYgBEECaiEEDAELIAdBBnQgBC0AAkE/cXIhBwJAIAZBcE8NACAHIAhBDHRyIQYgBEEDaiEEDAELIAdBBnQgBC0AA0E/cXIgCEESdEGAgPAAcXIhBiAEQQRqIQQLIAMgBGohBCAGQSNGDQALCyABIAVqIQQCQAJAAkAgAiAFayIGQQJJDQACQCAGQQJGDQAgBCwAAkG/f0wNAQtBASECQQEhAwJAIAQgBC0AAEErRiIBaiIHLQAAIgVBv39qQV9xQQpqIAVBUGogBUE5SxsiBUEPSw0AQQAhAgJAIAFFDQAgBSEDDAELQQEhAkEBIQMgBy0AASIBQb9/akFfcUEKaiABQVBqIAFBOUsbIgFBD0sNACAFQQR0IAFyIQNBACECCyAGQQRJDQEgBCwAAiIFQUBIDQECQCAGQQRGDQAgBCwABEG/f0wNAgtBASEBQQEhBwJAIARBAmogBUErRiIIaiIJLQAAIgVBv39qQV9xQQpqIAVBUGogBUE5SxsiBUEPSw0AQQAhAQJAIAhFDQAgBSEHDAELQQEhAUEBIQcgCS0AASIIQb9/akFfcUEKaiAIQVBqIAhBOUsbIghBD0sNACAFQQR0IAhyIQdBACEBCyAGQQZJDQIgBCwABCIIQUBIDQICQCAGQQZGDQAgBCwABkG/f0wNAwtBASEGQQEhBQJAIARBBGogCEErRiIIaiIJLQAAIgRBv39qQV9xQQpqIARBUGogBEE5SxsiBEEPSw0AQQAhBgJAIAhFDQAgBCEFDAELQQEhBkEBIQUgCS0AASIIQb9/akFfcUEKaiAIQVBqIAhBOUsbIghBD0sNACAEQQR0IAhyIQVBACEGCyAARAAAAAAAAPA/IAVB/wFxuEQAAAAAAOBvQKMgBhs5AxAgAEQAAAAAAADwPyAHQf8BcbhEAAAAAADgb0CjIAEbOQMIIABEAAAAAAAA8D8gA0H/AXG4RAAAAAAA4G9AoyACGzkDAA8LIAQgBkEAQQIjgYCAgABBuJHBgABqEKeCgIAAAAsgBCAGQQJBBCOBgICAAEHIkcGAAGoQp4KAgAAACyAEIAZBBEEGI4GAgIAAQdiRwYAAahCngoCAAAALggMEAX8BfAF/BHwjgICAgABBIGsiAySAgICAAEQAAAAAAAAAACEEAkAgAr1CAYZC/////////29WDQBEAAAAAAAA8D9EAAAAAAAAAAAgAiACRAAAAAAAAAAAYxsiBCAERAAAAAAAAPA/ZBtEAAAAAAAAHECiIQQLAkACQEQAAAAAAAAYQCAEnCICIAIgAmIbIgJEAAAAAAAAGEAgAkQAAAAAAAAYQGMb/AMiBUEHSw0AIANBCGogASAFQQN0aiIBKAIAIAEoAgQQrICAgAAgBUEHRw0BQQhBCCOBgICAAEH4kcGAAGoQn4KAgAAACyAFQQgjgYCAgABB6JHBgABqEJ+CgIAAAAsgAysDGCECIAMrAxAhBiADKwMIIQcgA0EIaiABKAIIIAEoAgwQrICAgAAgAysDCCEIIAMrAxAhCSAAIAIgBCAFuKEiBCADKwMYIAKhoqA5AxAgACAGIAQgCSAGoaKgOQMIIAAgByAEIAggB6GioDkDACADQSBqJICAgIAAC9ovDA5/AXwDfwF+AXwBfgp/A3wCfwF8AX8CfiOAgICAAEGQAmsiAySAgICAACABIAJBPGwiBGohBQJAAkACQAJAAkACQAJAAkACQAJAIAJFDQAgBCEGIAEhBwNAIAdBMGooAgBBA0YNAiAHQTxqIQcgBkFEaiIGDQALC0EEIQhBACEJQQAhCgwBCxC5gICAAEEQQQQQtYCAgAAiC0UNASAHQTxqIQYgCyAHNgIAIANBATYCQCADIAs2AjwgA0EENgI4QQEhCQJAA0AgBiAFRg0BIAZBMGohByAGQTxqIgwhBiAHKAIAQQNHDQACQCAJIAMoAjhHDQAgA0E4aiAJQQFBBEEEEKmAgIAAIAMoAjwhCwsgCyAJQQJ0aiAMQURqNgIAIAMgCUEBaiIJNgJAIAwhBgwACwsgAygCPCEIIAMoAjghCiAJQQJJDQACQCAJQRVJDQAgCCAJIANBOGoQoYCAgAAMAQsgCCAJEKaAgIAACwJAAkACQAJAIAJFDQACQANAIAFBMGooAgBBAkYNASABQTxqIQEgBEFEaiIERQ0CDAALCxC5gICAAEEQQQQQtYCAgAAiBEUNAyABQTxqIQYgBCABNgIAIANBATYCQCADIAQ2AjwgA0EENgI4QQEhDQJAA0AgBiAFRg0BIAZBMGohASAGQTxqIgchBiABKAIAQQJHDQACQCANIAMoAjhHDQAgA0E4aiANQQFBBEEEEKmAgIAAIAMoAjwhBAsgBCANQQJ0aiAHQURqNgIAIAMgDUEBaiINNgJAIAchBgwACwsgAygCPCEOIAMoAjghDwJAIA1BAkkNAAJAIA1BFUkNACAOIA0gA0E4ahCfgICAAAwBCyAOIA0QpoCAgAALAkAgCUUNACANIRAMAgtEAAAAAAAAJkAhEUEEIRJBACETQQEhBUEAIRQMBgtBBCEOQQAhEyAJRQ0BQQAhEEEAIQ8LELmAgIAAAkAgCUECdCITQQQQuICAgAAiEkUNAAJAIBANAEEAIQ0MBQsgDiAQQQJ0aiEMIAmtIRUgCbghFiAOIQQDQAJAAkAgBCgCACIGKAIIIgUNAEHFu/KIeCEBDAELIAYoAgQhBiAFQQdxIQdBxbvyiHghAQJAIAVBCEkNACAFQXhxIQVBxbvyiHghAQNAIAEgBi0AAHNBk4OACGwgBkEBai0AAHNBk4OACGwgBkECai0AAHNBk4OACGwgBkEDai0AAHNBk4OACGwgBkEEai0AAHNBk4OACGwgBkEFai0AAHNBk4OACGwgBkEGai0AAHNBk4OACGwgBkEHai0AAHNBk4OACGwhASAGQQhqIQYgBUF4aiIFDQALIAdFDQELA0AgASAGLQAAc0GTg4AIbCEBIAZBAWohBiAHQX9qIgcNAAsLAkAgAUENdiABc7dEAABAZXr01kGinSIRIBFEAAAAAAAA8D2inUQAAAAAAADwQaKhIBGmIhFEAAAAAAAA8EGgIBEgEUQAAAAAAAAAAGMb/AMiBkEPdiAGc7hEAAAAAAAA8D2iIBainPwGIBWBIhdCf1cNAAJAIAkgF6ciBk0NACASIAZBAnRqIgYgBigCAEEBajYCAAwBCyAGIAkjgYCAgABBiJLBgABqEJ+CgIAAAAsgBEEEaiIEIAxHDQALIBAhDQwEC0EEIBMQioKAgAAAC0EIIRBBASEYQQAhDUEAIQ9BACEZQQQhEkEBIRRBACELDAQLQQRBEBCKgoCAAAALQQRBEBCKgoCAAAALIBIhBwJAIAlBAUYNACAJQf////8DaiIHQQNxIQQgEigCACEGQQAhGgJAAkAgB0H/////A3FBf2pBA08NACASIQcMAQsgEkEQaiEBIAdB/P///wNxIRtBACEaIBIhBwNAIAEoAgAiBSABQXxqIhwoAgAiDCABQXhqIhQoAgAiAiABQXRqIh0oAgAiCyAGIh4gCyAeSxsiHyACIB9LGyIgIAwgIEsbIiEgBSAhSxshBiAHIB0gCyAeSRsgFCACIB9JGyAcIAwgIEkbIAEgBSAhSRshByABQRBqIQEgGyAaQQRqIhpHDQALIARFDQELIBpBAnQgEmpBBGohAQNAIAcgASABKAIAIgUgBkkbIQcgAUEEaiEBIAUgBiAFIAZLGyEGIARBf2oiBA0ACwsgEEUhFEEAIQUgByOBgICAAEH0k8CAAGogBxsoAgAiBiAGQQBHa7hEAAAAAAAAGECiRAAAAAAAACJAoETNzMzMzMz0P6AiESARoESamZmZmZkZQKBEAAAAAAAAAECgIRELIAlBqAFsIQZBACEBIAlBsJiMBksNAkEAIQsCQAJAIAYNAEEIIRBBACEZDAELELmAgIAAQQghASAJIRkgBkEIELWAgIAAIhBFDQMLAkAgBUUNAEEBIRgMAQsgE0EOargiFiAWIBFEGC1EVPshCUAgCbijEPCBgIAAIiIgIqCjIhEgESARYhsiESAWIBFkGyEjIANB8ABqIQIgA0GsAWohISADQaABaiEaQQAhDCAJQQFGIRwDQAJAAkAgCCAMQQJ0aigCACIEKAIIIgUNAEHFu/KIeCEBDAELIAQoAgQhBiAFQQdxIQdBxbvyiHghAQJAIAVBCEkNACAFQXhxIQVBxbvyiHghAQNAIAEgBi0AAHNBk4OACGwgBkEBai0AAHNBk4OACGwgBkECai0AAHNBk4OACGwgBkEDai0AAHNBk4OACGwgBkEEai0AAHNBk4OACGwgBkEFai0AAHNBk4OACGwgBkEGai0AAHNBk4OACGwgBkEHai0AAHNBk4OACGwhASAGQQhqIQYgBUF4aiIFDQALIAdFDQELA0AgASAGLQAAc0GTg4AIbCEBIAZBAWohBiAHQX9qIgcNAAsLRAAAAAAAAAAAIRYgAUENdiABc7dEAABAZXr01kGinSIRIBFEAAAAAAAA8D2inUQAAAAAAADwQaKhIBGmIhFEAAAAAAAA8EGgIBEgEUQAAAAAAAAAAGMb/AMiBkEPdiAGc7hEAAAAAAAA8D2iIRFEAAAAAAAAAAAhIkQAAAAAAAAAACEkAkAgHA0AIBFEAAAAAAAA4L+gRAAAAAAAABBAoiEiIAy4RPtL+usfMwNAoiIkEPCBgIAAICOiIRYgJBDngYCAACAjoiEkCyADQfgBaiAEEI+CgIAAIANBhAJqIAQgBEEMaiAEKAIMQX9GGxCPgoCAAEEAIQdBASEFQQEhC0EAIR5BACEfAkAgBCgCGEF/Rg0AIANBGGogBEEYahCPgoCAACADKAIgIR8gAygCHCELIAMoAhghHgsgBC0AOCEGQQAhIAJAIAQoAiRBf0YNACADQRhqIARBJGoQj4KAgAAgAygCICEgIAMoAhwhBSADKAIYIQcLELmAgIAAQQRBARC1gICAACIBRQ0CIAFB8+iFkwc2AAAgA0E4aiOBgICAAEG4kMGAAGogERCtgICAACAaIAMpAvgBNwMAIBogAygCgAI2AgggISADKQKEAjcCACAhIAMoAowCNgIIIAMgHzYCwAEgAyALNgK8ASADIB42ArgBIANBBDYC2AEgAyABNgLUASADQQQ2AtABIAMgIDYCzAEgAyAFNgLIASADIAc2AsQBIANBASAGIAZB/wFxQQJGGzoA3AEgBCgCNCEGIAJCADcDACACQgA3AwggAkIANwMQIAJCADcDGCADIBY5A2ggAyAiOQNgIAMgJDkDWCADIBFEmpmZmZmZ6T+iRDMzMzMzMwNAoDkDUCADIAY2ApwBIANCgICAgICAgKrAADcDkAEgAyAGQQggBkEISRs2ApgBIBAgDEGoAWxqIANBOGpBqAH8CgAAIAxBAWoiDCAJRw0AC0EAIRggCSELCwJAAkAjg4CAgAAtABBBAUcNACODgICAACIGKQMIIRUgBikDACEXDAELIANBOGoQ9ICAgAAjg4CAgAAiBkEBOgAQIAYgAykDQCIVNwMIIAMpAzghFwsgAyAXNwMoI4OAgIAAIBdCAXw3AwAgAyAVNwMwIAMjgYCAgABBiJDBgABqIgYpAwA3AxggAyAGKQMINwMgIA1BqAFsIQZBACEBAkAgDUGwmIwGSw0AQQAhDAJAAkAgBg0AQQghJUEAISYMAQsQuYCAgABBCCEBIA0hJiAGQQgQtYCAgAAiJUUNAQsjgYCAgAAhBgJAIBRFDQAgBkGAgMCAAGohCUEAIQ0MBAsjgYCAgABBgIDAgABqIQkgC7ghJyADQawBaiEcIANBOGpB6ABqIRQgA0EoaiEoQQAhDEEAIQIDQAJAAkAgDiACQQJ0aigCACIEKAIIIgUNAEHFu/KIeCEBDAELIAQoAgQhBiAFQQdxIQdBxbvyiHghAQJAIAVBCEkNACAFQXhxIQVBxbvyiHghAQNAIAEgBi0AAHNBk4OACGwgBkEBai0AAHNBk4OACGwgBkECai0AAHNBk4OACGwgBkEDai0AAHNBk4OACGwgBkEEai0AAHNBk4OACGwgBkEFai0AAHNBk4OACGwgBkEGai0AAHNBk4OACGwgBkEHai0AAHNBk4OACGwhASAGQQhqIQYgBUF4aiIFDQALIAdFDQELA0AgASAGLQAAc0GTg4AIbCEBIAZBAWohBiAHQX9qIgcNAAsLIAFBDXYgAXO3RAAAQGV69NZBop0iESARRAAAAAAAAPA9op1EAAAAAAAA8EGioSARpiIRRAAAAAAAAPBBoCARIBFEAAAAAAAAAABjG/wDIgZBD3YgBnO4RAAAAAAAAPA9oiERAkACQAJAAkACQCALRQ0AIBAgESAnopz8AyALcEGoAWxqIgYrAzAhFiAGKwMoISIgBisDICEkIANB4AFqIAZB6ABqEI+CgIAAIAMoAuQBIQEgAygC6AEhBQwBCxC5gICAAEEEQQEQtYCAgAAiAUUNASABQePeyasGNgAAQQQhBSADQQQ2AugBIAMgATYC5AEgA0EENgLgAUEAIQZEAAAAAAAAAAAhJEQAAAAAAAAAACEiRAAAAAAAAAAAIRYLIAwgAykDKCADKQMwIANB4AFqEJyAgIAAIhenIh9xIQcgF0IZiCIpQv8Ag0KBgoSIkKDAgAF+IRVBACEgAkACQANAAkAgCSAHaikAACIqIBWFIhdCf4UgF0L//fv379+//358g0KAgYKEiJCgwIB/gyIXUA0AA0ACQCAJIBd6p0EDdiAHaiAMcUEEdGsiHkF4aigCACAFRw0AIB5BdGooAgAgASAFEPGBgIAARQ0ECyAXQn98IBeDIhdQRQ0ACwsgKiAqQgGGg0KAgYKEiJCgwIB/g1BFDQIgByAgQQhqIiBqIAxxIQcMAAsLIAMoAuABIgdFDQIgASAHQQEQtoCAgAAMAgsCQCADKAIgDQAgA0EQaiADQRhqQQEgKEEBEJuAgIAACwJAIAMoAuABIglBf0cNACAfIR4MAgsCQCADKAIYIgcgAygCHCIBIB9xIgVqKQAAQoCBgoSIkKDAgH+DIhdCAFINAEEIIQwDQCAFIAxqIQUgDEEIaiEMIAcgBSABcSIFaikAAEKAgYKEiJCgwIB/gyIXUA0ACwsCQCAHIBd6p0EDdiAFaiABcSIFaiwAACIMQQBIDQAgByAHKQMAQoCBgoSIkKDAgH+DeqdBA3YiBWotAAAhDAsgAykC5AEhFyAHIAVqICmnQf8AcSIeOgAAIAcgBUF4aiABcWpBCGogHjoAAEEAIQEgByAFQQR0ayIHQXxqQQA2AgAgB0F0aiAXNwIAIAdBcGogCTYCACADIAMoAiRBAWo2AiQgAyADKAIgIAxBAXFrNgIgDAILQQFBBBCKgoCAAAALIB5BfGooAgAhAQsCQAJAAkAgC0UNACADQYQCaiAGQegAahCPgoCAAAwBCxC5gICAAEEEQQEQtYCAgAAiBkUNASAGQePeyasGNgAAIANBBDYCjAIgAyAGNgKIAiADQQQ2AoQCCyADKQMoIAMpAzAgA0GEAmoQnICAgAAhFwJAIAMoAiANACADQQhqIANBGGpBASAoQQEQm4CAgAALIAFBAWohICADKAIcIgwgF6dxIQYgF0IZiCIpQv8Ag0KBgoSIkKDAgAF+IRVBACEhIAMoAogCIR8gAygCjAIhBSADKAIYIQlBACEaA0ACQAJAAkACQAJAAkAgCSAGaikAACIqIBWFIhdCf4UgF0L//fv379+//358g0KAgYKEiJCgwIB/gyIXUA0AA0ACQCAFIAkgF3qnQQN2IAZqIAxxQQR0ayIeQXhqKAIARw0AIB8gHkF0aigCACAFEPGBgIAARQ0DCyAXQn98IBeDIhdQRQ0ACwsgKkKAgYKEiJCgwIB/gyEXAkAgIUEBRg0AIBdQDQMgF3qnQQN2IAZqIAxxIQcLAkAgFyAqQgGGg0IAUg0AQQEhIQwFCwJAIAkgB2osAAAiBkEASA0AIAkgCSkDAEKAgYKEiJCgwIB/g3qnQQN2IgdqLQAAIQYLIAkgB2ogKadB/wBxIgU6AAAgCSAHQXhqIAxxakEIaiAFOgAAIAkgB0EEdGsiB0F8aiAgNgIAIAdBcGoiByADKAKMAjYCCCAHIAMpAoQCNwIAIAMgAygCJEEBajYCJCADIAMoAiAgBkEBcWs2AiAMAQsgHkF8aiAgNgIAIAMoAoQCIgZFDQAgHyAGQQEQtoCAgAALIANB7AFqIAQQj4KAgAAgA0H4AWogBCAEQQxqIAQoAgxBf0YbEI+CgIAAQQEhBUEAIR5BACEfQQEhIEEAISECQCAEKAIYQX9GDQAgA0GEAmogBEEYahCPgoCAACADKAKMAiEhIAMoAogCISAgAygChAIhHwsgBC0AOCEHQQAhGgJAIAQoAiRBf0YNACADQYQCaiAEQSRqEI+CgIAAIAMoAowCIRogAygCiAIhBSADKAKEAiEeCxC5gICAAEEGQQEQtYCAgAAiBkUNASAGI4GAgIAAIh1BtJPAgABqIhsvAAQ7AAQgBiAbKAAANgAAIANBOGogHUH4kMGAAGogERCtgICAACAUIAMpAuwBNwMAIBQgAygC9AE2AgggHCADKQL4ATcCACAcIAMoAoACNgIIIANBASAHIAdB/wFxQQJGGzoA3AEgAyAhNgLAASADICA2ArwBIAMgHzYCuAEgA0EGNgLYASADIAY2AtQBIANBBjYC0AEgAyAaNgLMASADIAU2AsgBIAMgHjYCxAEgAyAEKAI0IgY2ApwBIAMgEUQAAAAAAAA0QKJEAAAAAAAAMECgOQOQASADIBFEAAAAAAAA4L+gRLgehetRuM4/ojkDiAEgAyARRBgtRFT7IQlAoiIjICOgOQOAASADIBY5A2ggAyAiOQNgIAMgJDkDWCADIBFEzczMzMzM3D+iRDMzMzMzM+s/oDkDUCADIAZBCCAGQQhJGzYCmAEgAyABuEQAAAAAAAAYQKJEAAAAAAAAIkCgIhE5A3AgAyARRAAAAAAAACJAo0QAAAAAAAD4PxDsgYCAAEQAAAAAAAA2QKI5A3ggJSACQagBbGogA0E4akGoAfwKAAAgAkEBaiICIA1HDQUMCQtBACEhDAELQQFBBhCKgoCAAAALIBpBCGoiGiAGaiAMcSEGDAALCwtBAUEEEIqCgIAAAAsgASAGEIqCgIAAAAtBAUEEEIqCgIAAAAsgASAGEIqCgIAAAAsgACANNgIUIAAgJTYCECAAICY2AgwgACALNgIIIAAgEDYCBCAAIBk2AgAgACALRSANQQBHcToAGAJAIAxFDQACQCADKAIkIgVFDQAgCUEIaiEBIAkpAwBCf4VCgIGChIiQoMCAf4MhFyAJIQYDQAJAIBdCAFINAANAIAEiB0EIaiEBIAZBgH9qIQYgBykDAEKAgYKEiJCgwIB/gyIXQoCBgoSIkKDAgH9RDQALIBdCgIGChIiQoMCAf4UhFwsgF0J/fCEVAkAgBiAXeqdBAXRB8AFxayIHQXBqKAIAIgRFDQAgB0F0aigCACAEQQEQtoCAgAALIBUgF4MhFyAFQX9qIgUNAAsLIAxBBHQiBiAMakEZaiIBRQ0AIAkgBmtBcGogAUEIELaAgIAACwJAIBgNACASIBNBBBC2gICAAAsCQCAPRQ0AIA4gD0ECdEEEELaAgIAACwJAIApFDQAgCCAKQQJ0QQQQtoCAgAALIANBkAJqJICAgIAAC38BA38jgICAgABBEGsiASSAgICAACABQQRqIAAoAgAiAiAAKAIEIAJBAXQiAkEEIAJBBEsbIgJBBEE8EKqAgIAAAkAgASgCBEEBRw0AIAEoAgggASgCDBCKgoCAAAALIAEoAgghAyAAIAI2AgAgACADNgIEIAFBEGokgICAgAALAgAL/wcEC38BfgJ/An4jgICAgABBMGsiAiSAgICAACABKAIEIQMCQAJAAkAgASgCCCIEDQBBBCEFDAELELmAgIAAIARBPGwiBkEEELWAgIAAIgVFDQFBACEHIAQhCANAIAJBIGogAyAHaiIGEI+CgIAAIAZBNGooAgAhCSAGQTBqKAIAIQpBfyELAkAgBkEMaiIMKAIAQX9GDQAgAkEEaiAMEI+CgIAAIAIpAgghDSACKAIEIQsLQX8hDEF/IQ4CQCAGQRhqIg8oAgBBf0YNACACQQRqIA8Qj4KAgAAgAikCCCEQIAIoAgQhDgsgBkE4ai0AACEPAkAgBkEkaiIGKAIAQX9GDQAgAkEEaiAGEI+CgIAAIAIpAgghESACKAIEIQwLIAUgB2oiBiACKAIoNgIIIAYgAikCIDcCACAGQThqIA86AAAgBkE0aiAJNgIAIAZBMGogCjYCACAGQShqIBE3AgAgBkEkaiAMNgIAIAZBHGogEDcCACAGQRhqIA42AgAgBkEQaiANNwIAIAZBDGogCzYCACAHQTxqIQcgCEF/aiIIDQALCyACQQRqIAUgBBCugICAACACIAIoAggiBjYCICACIAYgAigCDEGoAWxqNgIkIAIgAkEvajYCKCAAIAJBIGoQsoCAgAAgAiACKAIUIgY2AiAgAiAGIAIoAhhBqAFsajYCJCACIAJBL2o2AiggAEEMaiACQSBqELKAgIAAIAAgAi0AHDoAGCACQQRqEJ2AgIAAIAJBBGpBDGoQnYCAgAACQCAERQ0AQQAhByAEIQsDQAJAIAUgB2oiBigCACIMRQ0AIAZBBGooAgAgDEEBELaAgIAACwJAIAZBDGooAgAiDEF/Rg0AIAxFDQAgBkEQaigCACAMQQEQtoCAgAALAkAgBkEYaigCACIMQX9GDQAgDEUNACAGQRxqKAIAIAxBARC2gICAAAsCQCAGQSRqKAIAIgxBf0YNACAMRQ0AIAZBKGooAgAgDEEBELaAgIAACyAHQTxqIQcgC0F/aiILDQALIAUgBEE8bEEEELaAgIAACwJAIARFDQAgAyEGA0ACQCAGKAIAIgdFDQAgBkEEaigCACAHQQEQtoCAgAALAkAgBkEMaigCACIHQX9GDQAgB0UNACAGQRBqKAIAIAdBARC2gICAAAsCQCAGQRhqKAIAIgdBf0YNACAHRQ0AIAZBHGooAgAgB0EBELaAgIAACwJAIAZBJGooAgAiB0F/Rg0AIAdFDQAgBkEoaigCACAHQQEQtoCAgAALIAZBPGohBiAEQX9qIgQNAAsLAkAgASgCACIGRQ0AIAMgBkE8bEEEELaAgIAACyACQTBqJICAgIAADwtBBCAGEIqCgIAAAAuNBAEKfyOAgICAAEGAAWsiAiSAgICAACABKAIEIgMgASgCACIBayIEQagBbiEFAkACQCAEQajmzJl7TQ0AQQAhBAwBCwJAAkAgAyABRw0AQQAhBUEEIQYMAQsQuYCAgABBBCEEIAVB+ABsIgNBBBC1gICAACIGRQ0BIAJBCGpBMGohByACQSxqIQggAkEIakEYaiEJIAJBFGohCiAGIQQgBSEDA0AgAkEIaiABQegAahCPgoCAACAKIAFB9ABqEI+CgIAAIAkgAUGAAWoQj4KAgAAgAUGkAWotAAAhCyAIIAFBjAFqEI+CgIAAIAcgAUGYAWoQj4KAgAAgAiALOgB8IAIgAUHgAGopAwA3AnQgAiABQdgAaisDALY4AnAgAiABQdAAaisDALY4AmwgAiABQcgAaisDALY4AmggAiABQcAAaisDALY4AmQgAiABQThqKwMAtjgCYCACIAFBMGorAwC2OAJcIAIgAUEoaisDALY4AlggAiABQSBqKwMAtjgCVCACIAFBGGorAwC2OAJQIAIgAUEQaisDALY4AkwgAiABQQhqKwMAtjgCSCACIAErAwC2OAJEIAQgAkEIakH4APwKAAAgBEH4AGohBCABQagBaiEBIANBf2oiAw0ACwsgACAFNgIIIAAgBjYCBCAAIAU2AgAgAkGAAWokgICAgAAPCyAEIAMQioKAgAAAC8YXCQp/AX4BfwF+A38Bfgx/DH0DfyOAgICAAEHAAGsiAiSAgICAACABQTxsIQMQu4CAgABBACEEAkACQAJAAkACQAJAAkACQAJAAkACQCABQaLEiBFLDQACQAJAIAMNAEEEIQVBACEDDAELELmAgIAAQQQhBCADQQQQtYCAgAAiBUUNASABIQMLIAJBADYCLCACIAU2AiggAiADNgIkAkAgAUUNAEEAIQZBACEHQQAhBANAIAAgBmoiA0EoaiEIIANBHGotAAAhCUF/IQpBfyELAkAgA0EQai0AAEEBcUUNACADQRhqKAIAIgutQiCGIANBFGo1AgCEIQwLIANBLGohDSAILQAAIQgCQCAJQQFxRQ0AIANBJGooAgAiCq1CIIYgA0EgajUCAIQhDgsgDS0AACEPQQIhCQJAIAhBAXFFDQAgA0Epai0AAEEARyEJCyADQQxqIQggA0EIaiEQIANBBGohEUF/IQ0CQCAPQQFxRQ0AIANBNGooAgAiDa1CIIYgA0EwajUCAIQhEgsgAygCACEPIAgoAgAhEyAQKAIAIRAgESgCACEIAkAgBCACKAIkRw0AIAJBJGoQr4CAgAAgAigCKCEFCyAFIAdqIgMgCDYCACADQThqIAk6AAAgA0E0aiATNgIAIANBMGogEDYCACADQShqIBI3AgAgA0EkaiANNgIAIANBHGogDjcCACADQRhqIAo2AgAgA0EQaiAMNwIAIANBDGogCzYCACADQQhqIAg2AgAgA0EEaiAPNgIAIAIgBEEBaiIENgIsIAZBOGohBiAHQTxqIQcgASAERw0ACyAAIAFBOGxBBBC2gICAAAsgAkEIaiACQSRqELGAgIAAIAItACAhFCACKAIcIRUgAigCFCEWIAIoAhghFyACKAIIIRggAigCDCEZIAJBMGpBBCACKAIQIhpB5ABsELqAgIAAIBkgGkH4AGxqIRsgAigCMCEcIBkhAwJAAkAgGkUNACAcIQQgGSEDAkADQCADKAIAIgtBf0YNASADQfAAaigCACEdIANB7ABqKAIAIR4gA0HoAGoqAgAhHyADQeQAaioCACEgIANB4ABqKgIAISEgA0HcAGoqAgAhIiADQdgAaioCACEjIANB1ABqKgIAISQgA0HQAGoqAgAhJSADQcwAaioCACEmIANByABqKgIAIScgA0HEAGoqAgAhKCADQcAAaioCACEpIANBPGoqAgAhKiADQThqKAIAIQogA0E0aigCACErIANBMGooAgAhECADQSxqKAIAIQggA0EoaigCACEsIANBJGooAgAhDyADQSBqKAIAIQcgA0EcaigCACEAIANBGGooAgAhDSADQRRqKAIAIQYgA0EQaigCACEBIANBDGooAgAhCSADQfQAai0AACEtIANBBGopAgAiEqchEwJAAkAgCyASQiCIIhKnIhFLDQAgEyEFDAELAkAgEkIAUg0AQQEhBSATIAtBARC2gICAAAwBCyATIAtBASARELeAgIAAIgVFDQYLIAQgBTYCACAEQQRqIBE2AgACQAJAIAkgBksNACABIQsMAQsCQCAGDQBBASELIAEgCUEBELaAgIAADAELIAEgCUEBIAYQt4CAgAAiC0UNBwsgBEEIaiALNgIAIARBDGogBjYCAAJAAkAgDSAHSw0AIAAhBgwBCwJAIAcNAEEBIQYgACANQQEQtoCAgAAMAQsgACANQQEgBxC3gICAACIGRQ0ICyAEQRhqIC06AAAgBEEQaiAGNgIAIARBFGogBzYCAAJAAkAgDyAISw0AICwhBgwBCwJAIAgNAEEBIQYgLCAPQQEQtoCAgAAMAQsgLCAPQQEgCBC3gICAACIGRQ0JCyAEQRxqIAY2AgAgBEEgaiAINgIAAkACQCAQIApLDQAgKyEGDAELAkAgCg0AQQEhBiArIBBBARC2gICAAAwBCyArIBBBASAKELeAgIAAIgZFDQoLIARB4ABqIB02AgAgBEHcAGogHjYCACAEQdgAaiAfOAIAIARB1ABqICA4AgAgBEHQAGogITgCACAEQcwAaiAiOAIAIARByABqICM4AgAgBEHEAGogJDgCACAEQcAAaiAlOAIAIARBPGogJjgCACAEQThqICc4AgAgBEE0aiAoOAIAIARBMGogKTgCACAEQSxqICo4AgAgBEEkaiAGNgIAIARBKGogCjYCACAEQeQAaiEEIANB+ABqIgMgG0cNAAwDCwsgA0H4AGohAwsgGyADa0H4AG4hBCAbIANGDQADQCADEJ6AgIAAIANB+ABqIQMgBEF/aiIEDQALCwJAIBhFDQAgGSAYQfgAbEEEELaAgIAACyOBgICAAEHEmcGAAGoiAyAcNgIAIAMgGjYCBCACQTBqQQQgFUHkAGwQuoCAgAAgFyAVQfgAbGohGyACKAIwIRkgFyEDAkACQCAVRQ0AIBkhBCAXIQMCQANAIAMoAgAiC0F/Rg0BIANB8ABqKAIAIR0gA0HsAGooAgAhHiADQegAaioCACEfIANB5ABqKgIAISAgA0HgAGoqAgAhISADQdwAaioCACEiIANB2ABqKgIAISMgA0HUAGoqAgAhJCADQdAAaioCACElIANBzABqKgIAISYgA0HIAGoqAgAhJyADQcQAaioCACEoIANBwABqKgIAISkgA0E8aioCACEqIANBOGooAgAhCiADQTRqKAIAISsgA0EwaigCACEQIANBLGooAgAhCCADQShqKAIAIS0gA0EkaigCACEPIANBIGooAgAhByADQRxqKAIAIQAgA0EYaigCACENIANBFGooAgAhBiADQRBqKAIAIQEgA0EMaigCACEJIANB9ABqLQAAISwgA0EEaikCACISpyETAkACQCALIBJCIIgiEqciEUsNACATIQUMAQsCQCASQgBSDQBBASEFIBMgC0EBELaAgIAADAELIBMgC0EBIBEQt4CAgAAiBUUNCwsgBCAFNgIAIARBBGogETYCAAJAAkAgCSAGSw0AIAEhCwwBCwJAIAYNAEEBIQsgASAJQQEQtoCAgAAMAQsgASAJQQEgBhC3gICAACILRQ0MCyAEQQhqIAs2AgAgBEEMaiAGNgIAAkACQCANIAdLDQAgACEGDAELAkAgBw0AQQEhBiAAIA1BARC2gICAAAwBCyAAIA1BASAHELeAgIAAIgZFDQ0LIARBGGogLDoAACAEQRBqIAY2AgAgBEEUaiAHNgIAAkACQCAPIAhLDQAgLSEGDAELAkAgCA0AQQEhBiAtIA9BARC2gICAAAwBCyAtIA9BASAIELeAgIAAIgZFDQ4LIARBHGogBjYCACAEQSBqIAg2AgACQAJAIBAgCksNACArIQYMAQsCQCAKDQBBASEGICsgEEEBELaAgIAADAELICsgEEEBIAoQt4CAgAAiBkUNDwsgBEHgAGogHTYCACAEQdwAaiAeNgIAIARB2ABqIB84AgAgBEHUAGogIDgCACAEQdAAaiAhOAIAIARBzABqICI4AgAgBEHIAGogIzgCACAEQcQAaiAkOAIAIARBwABqICU4AgAgBEE8aiAmOAIAIARBOGogJzgCACAEQTRqICg4AgAgBEEwaiApOAIAIARBLGogKjgCACAEQSRqIAY2AgAgBEEoaiAKNgIAIARB5ABqIQQgA0H4AGoiAyAbRw0ADAMLCyADQfgAaiEDCyAbIANrQfgAbiEEIBsgA0YNAANAIAMQnoCAgAAgA0H4AGohAyAEQX9qIgQNAAsLAkAgFkUNACAX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IQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQYGUwIAAakGtASAEQcSSwYAAahCWgoCAAAALIANB/wFxQQNHDQEgBEEEchC4goCAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAAL7QIBA38jgICAgABBwABrIgEkgICAgABB/wEhAgJAIAAtAA0NAEEBIQIjgYCAgABB3JnBgABqKAIAQQFLDQAQ7YCAgAAhAgsgASACOgAbIAEgACgCCDYCHCABQRBqIAAoAgAgACgCBBDvgICAACABIAEpAxA3AiAgASABQRtqNgIwIAEgAUEgajYCLCABIAFBHGo2AiggAUEIakEAEPCAgIAAAkACQAJAIAEoAghBAXENACABKAIMIgANAQsgAUEoaiABQT9qI4GAgIAAQfCUwYAAahDTgICAAAwBCyOBgICAACECIAFBKGogAEEIahDogICAACIDQQRqIAJBmJXBgABqENOAgIAAIANBADoAACABIAAQ8ICAgAAgASgCAEEBcQ0AIAEoAgQhACABQQE2AjQgASAANgI4IABFDQAgACAAKAIAIgJBf2o2AgAgAkEBRw0AIAFBNGpBBGoQzICAgAALIAFBwABqJICAgIAAC24BAX8jgICAgABBIGsiAiSAgICAACACIAAgARCdgYCAADYCBCACI4mAgIAArUIghiACQQRqrYQ3AxAgAkEIaiACQR9qI4GAgIAAQYGRwIAAaiACQRBqENeAgIAAIAJBCGoQvoCAgAAQ0oCAgAAAC3EBAX8jgICAgABBEGsiAiSAgICAAAJAAkACQCABQQhLDQAgASAATQ0BCyACQQA2AgwgAkEMaiABQQQgAUEESxsgABCHgoCAACEBQQAgAigCDCABGyEBDAELIAAQ/4GAgAAhAQsgAkEQaiSAgICAACABCwkAENKAgIAAAAsKACAAEIKCgIAAC50BAQJ/I4CAgIAAQRBrIgQkgICAgAACQAJAAkAgAkEISw0AIAIgA00NAQtBACEFIARBADYCDCAEQQxqIAJBBCACQQRLGyADEIeCgIAADQEgBCgCDCICRQ0BAkAgASADIAEgA0kbIgNFDQAgAiAAIAP8CgAACyAAEIKCgIAAIAIhBQwBCyAAIAMQhYKAgAAhBQsgBEEQaiSAgICAACAFCzgCAX8BfiOAgICAAEEQayIBJICA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A0F/Rw0AQQIhAgwBCwJAAkACQAJAIAAoAgxBf2oOBAACAgECCyAAKAIIIgQtAABBMEcNAUEDIQFBAiECIAMNAgwDCyAAKAIIIgQoAABB5uqx4wZHDQBBAiEBQQEhAiADDQEMAgtBASEBQQAhAiADRQ0BIAAoAgghBAsgBCADQQEQtoCAgAALI4GAgIAAQYSawYAAaiIDIAMtAAAiAyABIAMbOgAAIANFDQAgA0F/akF/IANBBEkbIQILIABBEGokgICAgAAgAgsJABCogYCAAAAL8gECA38CfiOAgICAAEEQayIDJICAgIAAIAMgASACKAIMIgQRgICAgACAgICAAEEEIQIgASEFAkACQCADKQMAQtzsp//F24D7uX+FIAMpAwhC8YPD46a+2OAkhYRQDQAgAyABIAQRgICAgACAgICAACADKQMIIQYgAykDACEHI4GAgIAAIQICQCAHQo34+rT6xKGewwCFIAZC7pz3wtmmgPOkf4WEQgBRDQAgAkGWmcCAAGohAUEMIQIMAgsgAUEEaiEFQQghAgsgASACaigCACECIAUoAgAhAQsgACACNgIEIAAgATYCACADQRBqJICAgIAAC+gBAQN/I4CAgIAAQRBrIgIkgICAgAACQAJAAkAgAQ0AI4GAgIAAQZSawYAAai0AAA0AQQAhAwwBCyOBgICAACIEQZSawYAAakEBOgAAIAIgATYCDAJAAkAgBEHklMGAAGoiBC0ABEUNACOBgICAAEHklMGAAGoQ5YCAgAAiBEUNAQsgBCgCACEDIAQgATYCAAwBCwJAIAENAEEBIQEMAgsgASABKAIAIgRBf2o2AgBBASEBAkAgBEEBRw0AIAJBDGoQzICAgAALDAELQQAhAQsgACADNgIEIAAgATYCACACQRBqJICAgIAAC9oCAQV/I4CAgIAAQRBrIgQkgICAgAACQAJAIANFDQAgBEEMaiEFA0ACQAJAAkACQAJAQQIgAiADEKSBgIAAIgZBf0cNACOBgICAACEHI42AgIAAKAIAIQgjjoCAgAAoAgAhBgJAIAggB0H4k8GAAGpGDQAjgYCAgABB+JPBgABqELWCgIAACyAEQQA6AAsgBEEAOwAJIAQgBjYCDCAEQQA6AAggBhCygoCAACgCCBGDgICAAICAgIAADQMgBEEIaiEGDAELIARB/wE6AAggBCAGNgIMI4GAgIAAIQcgBg0BIAdB0JXBgABqIQYLIAAgBikCADcCAAwFCwJAIAMgBkkNACACIAZqIQIgAyAGayEDDAILIAYgAyADI4GAgIAAQdCWwYAAahCXgoCAAAALIAQtAAhBA0cNACAFELiCgIAACyADDQALCyAAQf8BOgAACyAEQRBqJICAgIAAC2QBAn8jj4CAgAAiASABKAIAIgJBAWo2AgBBACEBAkAgAkEASA0AQQEhASOBgICAAEHcmcGAAGotAAQNACOBgICAAEHcmcGAAGoiASAAOgAEIAEgASgCAEEBajYCAEECIQELIAELHAAgACgCACABIAAoAgQoAgwRhICAgACAgICAAAsKACAAEJ+BgIAAC8MBAQF/I4CAgIAAQZAIayICJICAgIAAIAJBAEGACPwLAAJAIAAgAkGACBD5gYCAAEEASA0AIAIgAhD6gYCAAEEBajYChAgjkICAgAAhACACIAI2AoAIIAIgAK1CIIYgAkGACGqthDcDiAgjgYCAgAAhACABKAIAIAEoAgQgAEHug8CAAGogAkGICGoQlYKAgAAhASACQZAIaiSAgICAACABDwsjgYCAgAAiAkGOnMCAAGpBJSACQfiVwYAAahCWgoCAAAALBwAgAEEbRgsvAQF/QSshAQJAIABBf2oiAEHKAEsNACOBgICAAEH9nMCAAGogAGotAAAhAQsgAQvrAgEEfyOAgICAAEEQayIBJICAgIAAAkAjgYCAgABB6JXBgABqKAIADQADQCOBgICAAEHolcGAAGoiAkF/NgIAAkAgAigCDCIDDQBBACEDAkAjgYCAgABB6JXBgABqKAIERQ0AI4GAgIAAQeiVwYAAaiICKAIIEIKCgIAAIAIoAgBBAWohAwsjgYCAgABB6JXBgABqIgJBADYCDCACQoCAgIDAADcCBCACIAM2AgACQCOLgICAACgCACICQQNJDQAji4CAgABBAjYCACACQXhqIgIgAigCACIDQX9qNgIAIAEgAjYCDCADQQFHDQAgAUEMahDCgICAAAsgAUEQaiSAgICAAA8LI4GAgIAAQeiVwYAAaiICIANBf2oiAzYCDCACKAIIIANBA3RqIgMoAgQhBCADKAIAIQMgAkEANgIAIAMgBBGFgICAAICAgIAAIAIoAgBFDQALCyOBgICAAEHYlcGAAGoQrIKAgAAACyUBAX8g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aiABIAIQlYKAgAALrQIBBH8jgICAgABBEGsiAiSAgICAACACQQA2AgQCQAJAIAFBgAFJDQAgAUE/cUGAf3IhAyABQQZ2IQQCQCABQYAQTw0AIAIgAzoABSACIARBwAFyOgAEQQIhAQwCCyABQQx2IQUgBEE/cUGAf3IhBAJAIAFB//8DSw0AIAIgAzoABiACIAQ6AAUgAiAFQeABcjoABEEDIQEMAgsgAiADOgAHIAIgBDoABiACIAVBP3FBgH9yOgAFIAIgAUESdkFwcjoABEEEIQEMAQsgAiABOgAEQQEhAQsgAkEIaiACIAJBBGogARDxgICAAAJAIAItAAgiAUH/AUYNAAJAIAAtAABBA0cNACAAQQRqELiCgIAACyAAIAIpAwg3AgALIAJBEGokgICAgAAgAUH/AUcLGwAgACOBgICAAEHsksGAAGogASACEJWCgIAACxsAIAAjgYCAgABBqJPBgABqIAEgAhCVgoCAAAtGAAJAAkACQCABDQAgA0UNAhC5gICAACADIAIQtYCAgAAiAkUNAQwCCyAAIAEgAiADELeAgIAAIgINAQsQ7oCAgAAACyACCwkAENuAgIAAAAsCAAs8AQF/I4CAgIAAQRBrIgEkgICAgAAgARCAgICAACAAIAEpAwg3AwggACABKQMANwMAIAFBEGokgICAgAALMgACQCABRQ0AI4GAgIAAIgFByJ3AgABqQTkgAUHcl8GAAGoQloKAgAAACyAAQQA2AgALIwACQCABRQ0AIAIgAxCMgoCAAAALIAAgAzYCBCAAIAI2AgALYwEBfwJAIAJBAEgNAAJAIAJFDQADQAJAIAFBBGooAgAiA0UNACAAIAEoAgAgAxCkgYCAAA8LIAFBCGohASACQX9qIgINAAsLIABBAEEAEKSBgIAADwsjjoCAgABBHDYCAEF/C+YBAgF/An4jgICAgABBEGsiAiSAgICAAAJAAkAgAQ0AQQAhAAwBCwJAIAAjkYCAgABHDQBBACEAEMqBgIAAIQMgAUEANgIMIAEgA0KAlOvcA4AiBDcDACABIAMgBEKAlOvcA359PgIIDAELAkAgACOSgICAAEcNACACEMyBgIAAQQAhACABQQA2AgwgAUH/k+vcAyACKAIIIAIpAwAiA0IAUxs2AgggASADQv///////////wAgA0L///////////8AVBs3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ACgCBEUNACAAKAIAEIKCgIAACwsKACAAEIOAgIAACwQAIAALCgAgABCEgICAAAsEACAACwoAIAAQhYCAgAALCgAgABCGgICAAAs1AQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCHgICAACAAIAEpAgg3AgAgAUEQaiSAgICAAAsOACAALQAAEIiAgIAAAAsLACAAEImAgIAAAAsKACAAEIqAgIAACz8BAX8jgICAgABBEGsiAiSAgICAACAAKAIAIAAoAgQgAkEIahCLgICAACABIAIpAgg3AgAgAkEQaiSAgICAAAt3AgF/AX4jgICAgABBEGsiAySAgICAACAAIAMQjICAgAACQAJAAkACQCADLQAADgIAAgELIAMpAwghBAsgASAENwMAQQEhAAwBCyACIAM1AgxCIIZCACADMQAIIgRQGyAEhDcCAEEAIQALIANBEGokgICAgAAgAAtcAQF/I4CAgIAAQRBrIgMkgICAgAAgACABKAIAIAEoAgQgA0EEahCNgICAAAJAIAMtAARBAUciAQ0AIAIgAy0ACDoAACACIAMoAgw2AgQLIANBEGokgICAgAAgAQtSAQF/I4CAgIAAQRBrIgIkgICAgAAgACACQQRqEI6AgIAAAkAgAi0ABEEBRyIADQAgASACLQAIOgAAIAEgAigCDDYCBAsgAkEQaiSAgICAACAACwoAIAAQj4CAgAALCAAQkICAgAALCAAQkYCAgAALCAAQkoCAgAALQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQk4CAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQlICAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQlYCAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLCAAQloCAgAALCgAgABCXgICAAAtDAQF/I4CAgIAAQRBrIgEkgICAgAAgARCYgICAACAAQQA2AgwgACABKAIINgIIIAAgASkDADcDACABQRBqJICAgIAACwgAEImCgIAAC7ICAQN/I4CAgIAAQSBrIgAkgICAgAACQAJAAkBBAUEYEISCgIAAIgENACOOgICAAEEwNgIADAELIAAgATYCGCAAI4GAgIAAQfSXwYAAajYCHCAAIAApAhg3AxBBfyEBIABBEGoQqoGAgABBAEgNAQJAQQFBGBCEgoCAACICDQAjjoCAgABBMDYCAAwCCyACQQE2AgQgACACNgIYIAAjgYCAgABB9JfBgABqNgIcIAAgACkCGDcDCCAAQQhqEKqBgIAAQQBIDQECQEEBQRgQhIKAgAAiAQ0AI46AgIAAQTA2AgAMAQsgAUECNgIEIAAgATYCGCAAI4GAgIAAQfSXwYAAajYCHCAAIAApAhg3AwBBACEBIAAQqoGAgABBf0oNAQtBfyEBCyAAQSBqJICAgIAAIAELYAEBfwJAIAAoAhAiAUUNACABELKBgIAACwJAIAAoAhQiAUUNACABELKBgIAACwJAIAAoAggiAUUNACABELWBgIAACwJAIAAoAgwiAUUNACABELeBgIAACyAAEIKCgIAAC2gBAX8CQCAAKAIERQ0AI46AgIAAQTo2AgBBfw8LAkAgACgCCCICDQAgABDEgYCAACICNgIICyACELaBgIAAIQIgASAAQRBqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEAC4IBAQF/AkAgACgCDCICDQACQAJAAkACQCAAKAIEQX9qDgICAAELEMaBgIAAIQIMAgsjjoCAgABBOjYCAEF/DwsQxYGAgAAhAgsgACACNgIMCyACELiBgIAAIQIgASAAQRRqNgIUIAFBADYCACABIAI2AhAgAUIANwMIIAFBAToABEEACw4AIAFBAEGQAfwLAEEACxMAQYCAgIABQYCAgCAgACgCBBsLqAEBAX8jgICAgABBEGsiASSAgICAAAJAAkACQAJAAkAgACgCBA4DAAECAwsgAUEMahDHgYCAAEUNAiABKAIMELmBgIAAQQEhAAwDCyABQQhqEMiBgIAARQ0BIAEoAggQuoGAgABBASEADAILIAFBBGoQyYGAgABFDQAgASgCBBC6gYCAAEEBIQAMAQsjjoCAgABBOzYCAEEAIQALIAFBEGokgICAgAAgAAubAQEEfxCmgYCAAEEAIQECQCAAQT0Q8oGAgAAiAiAARg0AIAAgAiAAayIDai0AACECI5OAgIAAIQQgAg0AIAQoAgAiBEUNACAEKAIAIgJFDQAgBEEEaiEEAkADQAJAIAAgAiADEPuBgIAADQAgAiADaiICLQAAQT1GDQILIAQoAgAhAiAEQQRqIQQgAg0ADAILCyACQQFqIQELIAELfAECfyAAQQA2AjggACOUgICAACIBQQAgARs2AjAgACABI5WAgIAAa0EAIAEbIgE2AjQgACOBgICAACICQdSawYAAaigCADYCDCACQdCYwYAAaiABQYCAgAQgAUGAgIAESRs2AgAgACAANgIAIAAgADYCCCAAIAA2AgRBAAsCAAv5AQEDfwJAI5aAgIAAIgIgAigCAEYNACOWgICAABDWgYCAABoLAkAjloCAgAAoAkQNACOBgICAACECI5aAgIAAIAJB4JrBgABqNgJECyOBgICAACICQeCewYAAahDigYCAABogASOCgICAAEG/gICAAGogARshAyACQYCfwYAAaigCACIEIQECQANAAkAjgYCAgABBkJ/BgABqIAFBAnRqIgIoAgANACAAIAE2AgAgAiADNgIAI4GAgIAAQYCfwYAAaiABNgIAQQAhAQwCCyABQQFqQf8AcSIBIARHDQALQQYhAQsjgYCAgABB4J7BgABqEN+BgIAAGiABCwIAC6EBAQJ/AkAjloCAgAAiASABKAIARg0AI5aAgIAAENaBgIAAGgsjgYCAgABB4J7BgABqEOKBgIAAGhDXgYCAACOWgICAACEBIABBAnQhAgNAIAEoAkQgAmpBADYCACABKAIIIgEjloCAgABHDQALI4GAgIAAIQEQ14GAgAAgAUGQn8GAAGogAEECdGpBADYCACABQeCewYAAahDfgYCAABpBAAtcAQF/AkAjloCAgAAiAiACKAIARg0AI5aAgIAAENaBgIAAGgsCQCOWgICAACgCRCAAQQJ0aiIAKAIAIAFGDQAgACABNgIAI5aAgIAAIgEgAS0AJkEBcjoAJgtBAAtZAQF/QRwhAgJAIABBAksNAAJAI5aAgIAAIgIgAigCAEYNACOWgICAABDWgYCAABoLAkAgAUUNACABI5aAgIAALQAkNgIACyOWgICAACAAOgAkQQAhAgsgAguIAQECfyOAgICAAEEQayIFJICAgIAAQQEgBUEMahDcgYCAABoCQAJAIANFDQBBHCEGIAMoAghB/5Pr3ANLDQELQQBBACAAIAEgAiADQQIQ/IGAgAAiA2siBiADQW9xQWVHGyAGIANBt39HGyEGCyAFKAIMQQAQ3IGAgAAaIAVBEGokgICAgAAgBgsfACAAIAFB/////wcgAUH/////B0kbQQAQ/YGAgAAaC34BBn8gACgCCCEBA0AgAEEAQQAgACgCACICQX9qIAJB/////wdxIgNBAUYbIANB/////wdGGyIEIAAoAgAiBSAFIAJGGzYCACAAKAIEIQYgBSACRw0ACwJAIAQNAAJAIAYNACACQX9KDQELIAAgAyABQYABcxDegYCAAAtBAAsgAQF/IAAgACgCACIBQf////8HIAEbNgIAQQpBACABGwu4AgEEfyOAgICAAEEQayICJICAgIAAAkAgABDggYCAACIDQQpHDQBBnH8hBAJAA0AgACgCAEUNASAAKAIEDQEgAkEANgIMIAAoAgBFDQEgACgCBA0BIAJBADYCDCAEQQJqIgQNAAsLIAAQ4IGAgAAiA0EKRw0AA0ACQCAAKAIAIgNFDQADQCAAIAAoAgQiBEEBaiAAKAIEIgUgBSAERhs2AgQgBSAERw0ACyAAIANBgICAgHhyIgQgACgCACIFIAUgA0YbNgIAIAAoAgghBSAAIAQjkoCAgAAgASAFQYABcxDdgYCAACEDA0AgACAAKAIEIgRBf2ogACgCBCIFIAUgBEYbNgIEIAUgBEcNAAsgA0UNACADQRtHDQILIAAQ4IGAgAAiA0EKRg0ACwsgAkEQaiSAgICAACADCwwAIABBABDhgYCAAAuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKALvh8ECn8CfBB/BHwjgICAgABBsARrIgUkgICAgABBACEGIAJBfWpBGG0iB0EAIAdBAEobIghBaGwgAmohCQJAI4GAgIAAQfCdwIAAaiAEQQJ0aigCACIKIANBf2oiC2oiAkEASA0AIAggC2shDAJAIAJFDQAgCiADaiICQQFxIQ0gCEECdCADQQJ0ayOBgICAAEGAnsCAAGpqQQhqIQcgAkF+cSEOIAVBwAJqIQJBACEGA0BEAAAAAAAAAAAhD0QAAAAAAAAAACEQAkAgDCAGaiIRQQBIDQAgB0F8aigCALchEAsgAiAQOQMAAkAgEUF/SA0AIAcoAgC3IQ8LIAJBCGogDzkDACACQRBqIQIgB0EIaiEHIA4gBkECaiIGRw0ACyANRQ0BIAwgBmohDAsCQAJAIAxBAE4NAEQAAAAAAAAAACEQDAELI4GAgIAAQYCewIAAaiAMQQJ0aigCALchEAsgBUHAAmogBkEDdGogEDkDAAsgCUFoaiESQQAhAiAKQQAgCkEAShshDSADQf7///8HcSERIANBAXEhEyADQQN0IAVBwAJqakFwaiEOA0AgAiEMAkACQCADQQFODQBEAAAAAAAAAAAhEAwBC0EAIQdEAAAAAAAAAAAhEAJAIAtFDQAgDiECIAAhBgNAIAZBCGorAwAgAisDAKIgBisDACACQQhqKwMAoiAQoKAhECACQXBqIQIgBkEQaiEGIBEgB0ECaiIHRw0ACyATRQ0BCyAAIAdBA3RqKwMAIAVBwAJqIAwgC2ogB2tBA3RqKwMAoiAQoCEQCyAFIAxBA3RqIBA5AwAgDkEIaiEOIAxBAWohAiAMIA1HDQALI4GAgIAAQYCewIAAaiAIQQJ0aiEIIANB/v///wdxIREgA0EBcSEUQS8gCWshFUEwIAlrIRYgBUHgA2pBfGoiFyAKQQJ0aiEYIAVBwAJqQXhqIRkgBUHgA2pBcGohGiAFQXBqIRsgEkF/aiEcIAohDAJAA0AgBSAMQQN0IgJqKwMAIRACQCAMQQFIDQBBACEHAkACQCAMQQFHDQAgDCECDAELIAxBAXEhDSAMQf7///8HcSEOIBsgAmohAkEAIQcgBUHgA2ohBgNAIAYgEEQAAAAAAABwPqL8ArciD0QAAAAAAABwwaIgEKD8AjYCACAGQQRqIAJBCGorAwAgD6AiEEQAAAAAAABwPqL8ArciD0QAAAAAAABwwaIgEKD8AjYCACACKwMAIA+gIRAgBkEIaiEGIAJBcGohAiAOIAdBAmoiB0cNAAsgDUUNASAMIAdrIQILIAVB4ANqIAdBAnRqIBBEAAAAAAAAcD6i/AK3Ig9EAAAAAAAAcMGiIBCg/AI2AgAgBSACQQN0akF4aisDACAPoCEQCyAQIBIQ74GAgAAiEEQAAAAAAADAP6KcRAAAAAAAACDAoiAQoCIQIBD8AiIdt6EhEAJAAkACQAJAAkAgEkEBSCIeDQAgBUHgA2ogDEECdGpBfGoiAiACKAIAIgIgAiAWdSICIBZ0ayIGNgIAIAYgFXUhHyACIB1qIR0MAQsgEg0BIAVB4ANqIAxBAnRqQXxqKAIAQRd1IR8LIB9BAUgNAgwBC0ECIR8gEEQAAAAAAADgP2YNAEEAIR8MAQtBASEGAkAgDEEBSA0AQQAhB0EAIQ4CQCAMQQFGDQAgDEEBcSEgIAxB/v///wdxIRNBACEHIAVB4ANqIQJBACEOA0AgAigCACEGAkACQAJAAkAgDkUNAEH///8HIQ4MAQsgBkUNAUGAgIAIIQ4LIAIgDiAGazYCAEEAIQ4MAQtBASEOCyACQQRqIg0oAgAhBgJAAkACQAJAIA4NAEH///8HIQ4MAQsgBkUNAUGAgIAIIQ4LIA0gDiAGazYCAEEBIQ5BACEGDAELQQAhDkEBIQYLIAJBCGohAiATIAdBAmoiB0cNAAsgIEUNAQsgBUHgA2ogB0ECdGoiBygCACECAkACQCAORQ0AQf///wchBgwBC0EBIQYgAkUNAUGAgIAIIQYLIAcgBiACazYCAEEAIQYLAkAgHg0AQf///wMhAgJAAkAgHA4CAQACC0H///8BIQILIAVB4ANqIAxBAnRqQXxqIgcgBygCACACcTYCAAsgHUEBaiEdIB9BAkcNAEQAAAAAAADwPyAQoSEQQQIhHyAGDQAgEEQAAAAAAADwPyASEO+BgIAAoSEQCwJAIBBEAAAAAAAAAABiDQACQCAMIApMDQAgDCAKayICQQNxIQdBACEGIAwhDgJAAkAgCiAMa0F8Sw0AIAJBfHEhDSAaIAxBAnRqIQJBACEGIAwhDgNAIAIoAgAgAkEEaigCACACQQhqKAIAIAJBDGooAgAgBnJycnIhBiACQXBqIQIgDkF8aiEOIA1BfGoiDQ0ACyAHRQ0BCyAXIA5BAnRqIQIDQCACKAIAIAZyIQYgAkF8aiECIAdBf2oiBw0ACwsgBkUNACAFQeADaiAMQQJ0akF8aiECA0AgDEF/aiEMIBJBaGohEiACKAIAIQYgAkF8aiECIAZFDQAMBAsLIBghAiAMIQ4DQCAOQQFqIQ4gAigCACEGIAJBfGohAiAGRQ0ACyAZIAMgDGpBA3RqIQ0DQCAFQcACaiAMIANqIhNBA3RqIAggDEEBaiIMQQJ0aigCALc5AwACQAJAIANBAU4NAEQAAAAAAAAAACEQDAELQQAhB0QAAAAAAAAAACEQAkAgC0UNACANIQIgACEGA0AgBkEIaisDACACKwMAoiAGKwMAIAJBCGorAwCiIBCgoCEQIAJBcGohAiAGQRBqIQYgESAHQQJqIgdHDQALIBRFDQELIAAgB0EDdGorAwAgBUHAAmogEyAHa0EDdGorAwCiIBCgIRALIAUgDEEDdGogEDkDACANQQhqIQ0gDCAOSA0ACyAOIQwMAQsLAkACQCAQQRggCWsQ74GAgAAiEEQAAAAAAABwQWZFDQAgBUHgA2ogDEECdGogEEQAAAAAAABwPqL8AiICt0QAAAAAAABwwaIgEKD8AjYCACAMQQFqIQwgCSESDAELIBD8AiECCyAFQeADaiAMQQJ0aiACNgIACwJAIAxBAEgNAEQAAAAAAADwPyASEO+BgIAAIRACQAJAIAxBAXFFDQAgDCEGDAELIAUgDEEDdGogECAFQeADaiAMQQJ0aigCALeiOQMAIAxBf2ohBiAQRAAAAAAAAHA+oiEQCwJAIAxFDQAgBkEBaiEHIAZBAnQgBUHgA2pqQXxqIQIgBkEDdCAFakF4aiEGA0AgBiAQRAAAAAAAAHA+oiIPIAIoAgC3ojkDACAGQQhqIBAgAkEEaigCALeiOQMAIAJBeGohAiAGQXBqIQYgD0QAAAAAAABwPqIhECAHQX5qIgcNAAsLIAUgDEEDdGohDiAMIQIDQAJAAkAgCiAMIAIiE2siCCAKIAhIGyICQQBODQBEAAAAAAAAAAAhEAwBCyACQQFqIgZBA3EhEQJAAkAgAkEDTw0AQQAhAkQAAAAAAAAAACEQDAELQQAhDUEAIAZBfHFrIQNEAAAAAAAAAAAhEEEAIQIDQCAOIAJqIgYrAwAhDyOBgICAAEHQs8CAAGogAmoiB0EYaisDACAGQRhqKwMAoiAHQRBqKwMAIAZBEGorAwCiIAdBCGorAwAgBkEIaisDAKIgDyAHKwMAoiAQoKCgoCEQIAJBIGohAiADIA1BfGoiDUcNAAsgEUUNAUEAIA1rIQILIAJBA3QhAgNAIA4gAmorAwAjgYCAgABB0LPAgABqIAJqKwMAoiAQoCEQIAJBCGohAiARQX9qIhENAAsLIAVBoAFqIAhBA3RqIBA5AwAgDkF4aiEOIBNBf2ohAiATQQBKDQALCwJAAkACQAJAAkAgBA4EAQICAAQLRAAAAAAAAAAAISECQCAMQQFIDQAgDCECAkAgDEEBcUUNACAFQaABaiAMQQN0aiICQXhqIgYgBisDACIQIAIrAwAiD6AiIjkDACACIA8gECAioaA5AwAgDEF/aiECCyAMQQFGDQAgAkECaiEGIAJBA3QgBUGgAWpqQXBqIQIDQCACIAIrAwAiDyACQQhqIgcrAwAiIiACQRBqIhErAwAiI6AiEKAiJDkDACARICMgIiAQoaA5AwAgByAQIA8gJKGgOQMAIAJBcGohAiAGQX5qIgZBAkoNAAsgDEEBRg0AIAxBAWohBiAMQQN0IAVBoAFqakF4aiECA0AgAiACKwMAIhAgAkEIaiIHKwMAIg+gIiI5AwAgByAPIBAgIqGgOQMAIAJBeGohAiAGQX9qIgZBAksNAAsgDEEBaiEGIAVBoAFqIAxBA3RqIQJEAAAAAAAAAAAhIQNAICEgAisDAKAhISACQXhqIQIgBkF/aiIGQQJLDQALCyAFKwOgASEQIB8NAiABIBA5AwAgASAhOQMQIAEgBSsDqAE5AwgMAwsCQAJAIAxBAE4NAEQAAAAAAAAAACEQDAELAkACQCAMQQFqQQNxIgcNAEQAAAAAAAAAACEQIAwhBgwBCyAFQaABaiAMQQN0aiECRAAAAAAAAAAAIRAgDCEGA0AgBkF/aiEGIBAgAisDAKAhECACQXhqIQIgB0F/aiIHDQALCyAMQQNJDQAgBkEBaiEHIAZBA3QgBUGgAWpqQWhqIQIDQCAQIAJBGGorAwCgIAJBEGorAwCgIAJBCGorAwCgIAIrAwCgIRAgAkFgaiECIAdBfGoiBw0ACwsgASAQmiAQIB8bOQMADAILAkACQCAMQQBODQBEAAAAAAAAAAAhEAwBCwJAAkAgDEEBakEDcSIHDQBEAAAAAAAAAAAhECAMIQYMAQsgBUGgAWogDEEDdGohAkQAAAAAAAAAACEQIAwhBgNAIAZBf2ohBiAQIAIrAwCgIRAgAkF4aiECIAdBf2oiBw0ACwsgDEEDSQ0AIAZBAWohByAGQQN0IAVBoAFqakFoaiECA0AgECACQRhqKwMAoCACQRBqKwMAoCACQQhqKwMAoCACKwMAoCEQIAJBYGohAiAHQXxqIgcNAAsLIAEgEJogECAfGzkDACAFKwOgASAQoSEQQQEhAgJAIAxBAUgNACAMQQNxIQYCQCAMQX9qQQNJDQAgDEH8////B3EhESAFQaABakEgaiECQQAhBwNAIBAgAkFoaisDAKAgAkFwaisDAKAgAkF4aisDAKAgAisDAKAhECACQSBqIQIgESAHQQRqIgdHDQALIAZFDQEgB0EBaiECCyAFQaABaiACQQN0aiECA0AgECACKwMAoCEQIAJBCGohAiAGQX9qIgYNAAsLIAEgEJogECAfGzkDCAwBCyABIBCaOQMAIAEgIZo5AxAgASAFKwOoAZo5AwgLIAVBsARqJICAgIAAIB1BB3ELmQkFAX8BfgJ/BHwBfyOAgICAAEEwayICJICAgIAAAkACQAJAAkAgAL0iA0IgiKciBEH/////B3EiBUH61L2ABEsNACAEQf//P3FB+8MkRg0BAkAgBUH8souABEsNAAJAIANCAFMNACABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIgY5AwAgASAAIAahRDFjYhphtNC9oDkDCEEBIQQMBQsgASAARAAAQFT7Ifk/oCIARDFjYhphtNA9oCIGOQMAIAEgACAGoUQxY2IaYbTQPaA5AwhBfyEEDAQLAkAgA0IAUw0AIAEgAEQAAEBU+yEJwKAiAEQxY2IaYbTgvaAiBjkDACABIAAgBqFEMWNiGmG04L2gOQMIQQIhBAwECyABIABEAABAVPshCUCgIgBEMWNiGmG04D2gIgY5AwAgASAAIAahRDFjYhphtOA9oDkDCEF+IQQMAwsCQCAFQbuM8YAESw0AAkAgBUG8+9eABEsNACAFQfyyy4AERg0CAkAgA0IAUw0AIAEgAEQAADB/fNkSwKAiAETKlJOnkQ7pvaAiBjkDACABIAAgBqFEypSTp5EO6b2gOQMIQQMhBAwFCyABIABEAAAwf3zZEkCgIgBEypSTp5EO6T2gIgY5AwAgASAAIAahRMqUk6eRDuk9oDkDCEF9IQQMBAsgBUH7w+SABEYNAQJAIANCAFMNACABIABEAABAVPshGcCgIgBEMWNiGmG08L2gIgY5AwAgASAAIAahRDFjYhphtPC9oDkDCEEEIQQMBAsgASAARAAAQFT7IRlAoCIARDFjYhphtPA9oCIGOQMAIAEgACAGoUQxY2IaYbTwPaA5AwhBfCEEDAMLIAVB+sPkiQRLDQELIAEgACAARIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIgZEAABAVPsh+b+ioCIHIAZEMWNiGmG00D2iIgihIgA5AwACQCAFQRR2IgQgAL1CNIinQf8PcWtBEUgNACABIAcgBkQAAGAaYbTQPaIiAKEiCSAGRHNwAy6KGaM7oiAHIAmhIAChoSIIoSIAOQMAAkAgBCAAvUI0iKdB/w9xa0EyTg0AIAkhBwwBCyABIAkgBkQAAAAuihmjO6IiAKEiByAGRMFJICWag3s5oiAJIAehIAChoSIIoSIAOQMACyAG/AIhBCABIAcgAKEgCKE5AwgMAQsCQCAFQYCAwP8HSQ0AIAEgACAAoSIAOQMAIAEgADkDCEEAIQQMAQsgAiADQv////////8Hg0KAgICAgICAsMEAhL8iAPwCtyIGOQMQIAIgACAGoUQAAAAAAABwQaIiAPwCtyIGOQMYIAIgACAGoUQAAAAAAABwQaI5AyAgAkEgaiEEQQQhCgNAIApBf2ohCiAEKwMAIQAgBEF4aiEEIABEAAAAAAAAAABhDQALIAJBEGogAiAFQRR2Qep3aiAKQQEQ5IGAgAAhBCACKwMAIQACQCADQn9VDQAgASAAmjkDACABIAIrAwiaOQMIQQAgBGshBAwBCyABIAA5AwAgASACKwMIOQMICyACQTBqJICAgIAAIAQLmgEBA3wgACAAoiIDIAMgA6KiIANEfNXPWjrZ5T2iROucK4rm5Vq+oKIgAyADRH3+sVfjHcc+okTVYcEZoAEqv6CiRKb4EBEREYE/oKAhBCAAIAOiIQUCQCACDQAgBSADIASiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBSAEoqGiIAGhIAVESVVVVVVVxT+ioKEL8wECAn8BfCOAgICAAEEQayIBJICAgIAAAkACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNLDQBEAAAAAAAA8D8hAyACQZ7BmvIDSQ0BIABEAAAAAAAAAAAQ44GAgAAhAwwBCwJAIAJBgIDA/wdJDQAgACAAoSEDDAELIAAgARDlgYCAACECIAErAwghACABKwMAIQMCQAJAAkACQCACQQNxDgQAAQIDAAsgAyAAEOOBgIAAIQMMAwsgAyAAQQEQ5oGAgACaIQMMAgsgAyAAEOOBgIAAmiEDDAELIAMgAEEBEOaBgIAAIQMLIAFBEGokgICAgAAgAwsMACAAIAChIgAgAKMLDQAgASABmiABIAAbogsTACAARAAAAAAAAABwEOmBgIAACxMAIABEAAAAAAAAABAQ6YGAgAAL2AgGAX4CfwF+An8Bfgl8IAG9IgJCNIinQf8PcSIDQcJ3aiEEAkACQAJAIAC9IgVCNIinIgZBgXBqQYJwSQ0AQQAhByAEQf9+Sw0BCwJAIAJCAYYiCEJ/fEL/////////b1QNAEQAAAAAAADwPyEJIAVCgICAgICAgPg/UQ0CIAhQDQICQAJAIAVCAYYiBUKAgICAgICAcFYNACAIQoGAgICAgIBwVA0BCyAAIAGgDwsgBUKAgICAgICA8P8AUQ0CRAAAAAAAAAAAIAEgAaIgBUKAgICAgICA8P8AVCACQgBTcxsPCwJAIAVCAYZCf3xC/////////29UDQAgACAAoiEJAkAgBUJ/VQ0AIAmaIAkgAhDtgYCAAEEBRhshCQsgAkJ/VQ0CRAAAAAAAAPA/IAmjDwtBACEHAkAgBUJ/VQ0AAkAgAhDtgYCAACIHDQAgABDogYCAAA8LQYCAEEEAIAdBAUYbIQcgBkH/D3EhBiAAvUL///////////8AgyEFCwJAIARB/35LDQBEAAAAAAAA8D8hCSAFQoCAgICAgID4P1ENAiADQb4HSQ0CAkAgAkIAUyAFQoCAgICAgID4P1ZGDQBBABDqgYCAAA8LQQAQ64GAgAAPCyAGDQAgAEQAAAAAAAAwQ6K9Qv///////////wCDQoCAgICAgIDgfHwhBQsCQCACQoCAgECDvyIKIAUgBUKAgICAsNXajEB8IgJCgICAgICAgHiDfSIFQoCAgIAIfEKAgICAcIO/IgkjgYCAgABBgMXAgABqIgQgAkItiKdB/wBxQQV0aiIGKwNIIguiRAAAAAAAAPC/oCIAIAAgBCsDECIMoiINoiIOIAJCNIe5Ig8gBCsDAKIgBisDWKAiECAAIAsgBb8gCaGiIhGgIgCgIgmgIgsgDiAJIAuhoCARIA0gDCAAoiIMoKIgDyAEKwMIoiAGKwNgoCAAIBAgCaGgoKCgIAAgACAMoiIJoiAJIAkgACAEKwNAoiAEKwM4oKIgACAEKwMwoiAEKwMooKCiIAAgBCsDIKIgBCsDGKCgoqAiDaAiAL1CgICAQIO/IgmiIgy9IgVCNIinQf8PcSIGQbd4akE/SQ0AAkAgBkHIB0sNAEQAAAAAAADwv0QAAAAAAADwPyAHGw8LIAZBiQhJIQRBACEGIAQNAAJAIAVCf1UNACAHEOuBgIAADwsgBxDqgYCAAA8LIAEgCqEgCaIgASANIAsgAKGgIAAgCaGgoqAgDCOBgICAAEGQtMCAAGoiBCsDAKIgBCsDCCIAoCIJIAChIgAgBCsDGKIgACAEKwMQoiAMoKCgIgAgAKIiASABoiAAIAQrAziiIAQrAzCgoiABIAAgBCsDKKIgBCsDIKCiIAQgCb0iBadBBHRB8A9xaiIEKwNwIACgoKAhACAEKQN4IAUgB618Qi2GfCECAkAgBg0AIAAgAiAFEO6BgIAADwsgAr8iASAAoiABoCEJCyAJC1UCAn8BfkEAIQECQCAAQjSIp0H/D3EiAkH/B0kNAEECIQEgAkGzCEsNAEEAIQFCAUGzCCACa62GIgNCf3wgAINCAFINAEECQQEgAyAAg1AbIQELIAELygEBBHwCQCACQoCAgIAIg0IAUg0AIAFCgICAgICAgPhAfL8iAyAAoiADoEQAAAAAAAAAf6IPCwJAIAFCgICAgICAgPA/fCICvyIDIACiIgQgA6AiAJlEAAAAAAAA8D9jRQ0AIAJCgICAgICAgICAf4O/IABEAAAAAAAA8L9EAAAAAAAA8D8gAEQAAAAAAAAAAGMbIgWgIgYgBCADIAChoCAAIAUgBqGgoKAgBaEiACAARAAAAAAAAAAAYRshAAsgAEQAAAAAAAAQAKILrgEAAkACQCABQYAISA0AIABEAAAAAAAA4H+iIQACQCABQf8PTw0AIAFBgXhqIQEMAgsgAEQAAAAAAADgf6IhACABQf0XIAFB/RdJG0GCcGohAQwBCyABQYF4Sg0AIABEAAAAAAAAYAOiIQACQCABQbhwTQ0AIAFByQdqIQEMAQsgAEQAAAAAAABgA6IhACABQfBoIAFB8GhLG0GSD2ohAQsgACABQf8Haq1CNIa/ogvqAQICfwF8I4CAgIAAQRBrIgEkgICAgAACQAJAIAC9QiCIp0H/////B3EiAkH7w6T/A0sNACACQYCAwPIDSQ0BIABEAAAAAAAAAABBABDmgYCAACEADAELAkAgAkGAgMD/B0kNACAAIAChIQAMAQsgACABEOWBgIAAIQIgASsDCCEAIAErAwAhAwJAAkACQAJAIAJBA3EOBAABAgMACyADIABBARDmgYCAACEADAMLIAMgABDjgYCAACEADAILIAMgAEEBEOaBgIAAmiEADAELIAMgABDjgYCAAJohAAsgAUEQaiSAgICAACAAC0kBA39BACEDAkAgAkUNAAJAA0AgAC0AACIEIAEtAAAiBUcNASABQQFqIQEgAEEBaiEAIAJBf2oiAg0ADAILCyAEIAVrIQMLIAML7AIBA38CQAJAAkACQCABQf8BcSICRQ0AIABBA3FFDQICQCAALQAAIgMNACAADwsgAyABQf8BcUcNASAADwsgACAAEPqBgIAAag8LAkAgAEEBaiIDQQNxDQAgAyEADAELIAMtAAAiBEUNASAEIAFB/wFxRg0BAkAgAEECaiIDQQNxDQAgAyEADAELIAMtAAAiBEUNASAEIAFB/wFxRg0BAkAgAEEDaiIDQQNxDQAgAyEADAELIAMtAAAiBEUNASAEIAFB/wFxRg0BIABBBGohAAsCQEGAgoQIIAAoAgAiA2sgA3JBgIGChHhxQYCBgoR4Rw0AIAJBgYKECGwhAgNAQYCChAggAyACcyIDayADckGAgYKEeHFBgIGChHhHDQFBgIKECCAAQQRqIgAoAgAiA2sgA3JBgIGChHhxQYCBgoR4Rg0ACwsgAEF/aiEDA0AgA0EBaiIDLQAAIgBFDQEgACABQf8BcUcNAAsLIAML+gIBAn8CQAJAAkAgASAAc0EDcUUNACABLQAAIQIMAQsCQCABQQNxRQ0AIAAgAS0AACICOgAAAkAgAg0AIAAPCyAAQQFqIQMCQCABQQFqIgJBA3ENACADIQAgAiEBDAELIAMgAi0AACICOgAAIAJFDQIgAEECaiEDAkAgAUECaiICQQNxDQAgAyEAIAIhAQwBCyADIAItAAAiAjoAACACRQ0CIABBA2ohAwJAIAFBA2oiAkEDcQ0AIAMhACACIQEMAQsgAyACLQAAIgI6AAAgAkUNAiAAQQRqIQAgAUEEaiEBC0GAgoQIIAEoAgAiAmsgAnJBgIGChHhxQYCBgoR4Rw0AA0AgACACNgIAIABBBGohAEGAgoQIIAFBBGoiASgCACICayACckGAgYKEeHFBgIGChHhGDQALCyAAIAI6AAACQCACQf8BcQ0AIAAPCyABQQFqIQIgACEDA0AgA0EBaiIDIAItAAAiADoAACACQQFqIQIgAA0ACwsgAwsPACAAIAEQ84GAgAAaIAALMAECfwJAIAAQ+oGAgABBAWoiARD/gYCAACICRQ0AIAFFDQAgAiAAIAH8CgAACyACCwQAIAALDAAgACABEPaBgIAAC2oBAn8CQCOBgICAAEH4o8GAAGooAiAiAQ0AI4GAgIAAQfijwYAAaiIBIAFBCGoiATYCIAsjgYCAgAAiAkHI5cCAAGogAkHg8cCAAGpBACAAIABBzABLG0EBdGovAQBqIAEoAhQQ94GAgAALbQEBfwJAAkAgABD4gYCAACIDEPqBgIAAIgAgAkkNAEHEACEAIAJFDQECQCACQX9qIgJFDQAgASADIAL8CgAACyABIAJqQQA6AABBxAAPCwJAIABBAWoiAkUNACABIAMgAvwKAAALQQAhAAsgAAvPAQEDfyAAIQECQAJAIABBA3FFDQACQCAALQAADQAgACAAaw8LIABBAWoiAUEDcUUNACABLQAARQ0BIABBAmoiAUEDcUUNACABLQAARQ0BIABBA2oiAUEDcUUNACABLQAARQ0BIABBBGoiAUEDcQ0BCyABQXxqIQIgAUF7aiEBA0AgAUEEaiEBQYCChAggAkEEaiICKAIAIgNrIANyQYCBgoR4cUGAgYKEeEYNAAsDQCABQQFqIQEgAi0AACEDIAJBAWohAiADDQALCyABIABrC4cBAQJ/AkAgAg0AQQAPCwJAAkAgAC0AACIDDQBBACEDDAELIABBAWohACACQX9qIQICQANAIANB/wFxIAEtAAAiBEcNASAERQ0BIAJBAEYNASACQX9qIQIgAUEBaiEBIAAtAAAhAyAAQQFqIQAgAw0AC0EAIQMLIANB/wFxIQMLIAMgAS0AAGsLogEBAn8jgICAgABBEGsiBSSAgICAAEFkIQYCQCAEQX1xIABBA3FyDQACQCAAKAIAIAFGDQBBeiEGDAELAkAgA0UNACADKAIIQf+T69wDSw0BAkAgBEUNACACIAUQo4GAgAANAiADKQMAIAUpAwB9IAMoAgggBSgCCEitfUJ/VQ0BQbd/IQYMAgsgAykDAEIAUw0BCwALIAVBEGokgICAgAAgBgsMAEFkQQAgAkEBSxsLTgACQCAADQA/AEEQdA8LAkAgAEH//wNxDQAgAEF/TA0AAkAgAEEQdkAAIgBBf0cNACOOgICAAEEwNgIAQX8PCyAAQRB0DwsQqIGAgAAACwoAIAAQgIKAgAALnC0BC38jgICAgABBEGsiASSAgICAAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAI4GAgIAAQZykwYAAaigCGCICDQACQCOBgICAAEH0p8GAAGooAgAiAw0AI4GAgIAAIgRB9KfBgABqIgVBADYCFCAFQn83AgwgBUKAgISAgIDAADcCBCAEQZykwYAAakEANgK8AyAFIAFBCGpBcHFB2KrVqgVzIgM2AgALI5eAgIAAIQUjmICAgAAgBUkNASOXgICAACEFQQAhAiOYgICAACAFa0HZAEkNACOXgICAACEEI5iAgIAAIQYjgYCAgABBnKTBgABqIgUgBiAEayIGNgLEAyAFIAQ2AsADIAUgBDYCECAFIAY2ArQDIAUgBjYCsAMgBSADNgIkIAVBfzYCIEGAfiEEA0AjgYCAgABBnKTBgABqIARqIgVBvAJqIAVBsAJqIgM2AgAgAyAFQagCaiIGNgIAIAVBtAJqIAY2AgAgBUHEAmogBUG4AmoiBjYCACAGIAM2AgAgBUHMAmogBUHAAmoiAzYCACADIAY2AgAgBUHIAmogAzYCACAEQSBqIgQNAAsjmICAgAAiA0FMakE4NgIAI4GAgIAAIgRBnKTBgABqIgUgBEH0p8GAAGooAhA2AhwgBSOXgICAACIEQXggBGtBD3EiBmoiAjYCGCAFIAMgBGsgBmtBSGoiBDYCDCACIARBAXI2AgQLAkACQCAAQewBSw0AAkAjgYCAgABBnKTBgABqKAIAIgdBECAAQRNqQfADcSAAQQtJGyIDQQN2IgR2IgVBA3FFDQACQAJAI4GAgIAAQZykwYAAaiAFQQFxIARyQQFzIgBBA3QiA2oiBEEoaiIFIAQoAjAiBCgCCCIGRw0AI4GAgIAAQZykwYAAaiAHQX4gAHdxNgIADAELIAUgBjYCCCAGIAU2AgwLIARBCGohBSAEIANBA3I2AgQgBCADaiIEIAQoAgRBAXI2AgQMDgsgAyOBgICAAEGcpMGAAGooAggiCE0NAQJAIAVFDQACQAJAI4GAgIAAQZykwYAAaiAFIAR0QQIgBHQiBUEAIAVrcnFoIglBA3QiBGoiBUEoaiIGIAUoAjAiBSgCCCIARw0AI4GAgIAAQZykwYAAaiAHQX4gCXdxIgc2AgAMAQsgBiAANgIIIAAgBjYCDAsgBSADQQNyNgIEIAUgBGogBCADayIGNgIAIAUgA2oiACAGQQFyNgIEAkAgCEUNACOBgICAAEGcpMGAAGoiBCAIQXhxakEoaiEDIAQoAhQhBAJAAkAgB0EBIAhBA3Z0IglxDQAjgYCAgABBnKTBgABqIAcgCXI2AgAgAyEJDAELIAMoAgghCQsgCSAENgIMIAMgBDYCCCAEIAM2AgwgBCAJNgIICyAFQQhqIQUjgYCAgABBnKTBgABqIgQgADYCFCAEIAY2AggMDgsjgYCAgABBnKTBgABqKAIEIgpFDQEjgYCAgABBnKTBgABqIApoQQJ0aigCsAIiBigCBEF4cSADayEEIAYhAAJAA0ACQCAGKAIQIgUNACAGKAIUIgVFDQILIAUoAgRBeHEgA2siBiAEIAYgBEkiBhshBCAFIAAgBhshACAFIQYMAAsLIAAoAhghAgJAIAAoAgwiBSAARg0AIAAoAggiBiAFNgIMIAUgBjYCCAwNCwJAAkAgACgCFCIGRQ0AIABBFGohCQwBCyAAKAIQIgZFDQQgAEEQaiEJCwNAIAkhCyAGIgVBFGohCSAFKAIUIgYNACAFQRBqIQkgBSgCECIGDQALIAtBADYCAAwMC0F/IQMgAEG/f0sNACAAQRNqIgRBcHEhAyOBgICAAEGcpMGAAGooAgQiCkUNAEEAIQVBHyEIAkAgAEHs//8HSw0AIANBJiAEQQh2ZyIEa3ZBAXEgBEEBdGtBPmohCAtBACADayEEAkACQAJAAkAjgYCAgABBnKTBgABqIAhBAnRqKAKwAiIGDQBBACEJDAELQQAhBSADQQBBGSAIQQF2ayAIQR9GG3QhAEEAIQkDQAJAIAYoAgRBeHEgA2siByAETw0AIAchBCAGIQkgBw0AQQAhBCAGIQkgBiEFDAMLIAUgBigCFCIHIAcgBiAAQR12QQRxaigCECILRhsgBSAHGyEFIABBAXQhACALIQYgCw0ACwsCQCAFIAlyDQBBACEJQQIgCHQiBUEAIAVrciAKcSIFRQ0DI4GAgIAAQZykwYAAaiAFaEECdGooArACIQULIAVFDQELA0AgBSgCBEF4cSADayIHIARJIQACQCAFKAIQIgYNACAFKAIUIQYLIAcgBCAAGyEEIAUgCSAAGyEJIAYhBSAGDQALCyAJRQ0AIAQjgYCAgABBnKTBgABqKAIIIANrTw0AIAkoAhghCwJAIAkoAgwiBSAJRg0AIAkoAggiBiAFNgIMIAUgBjYCCAwLCwJAAkAgCSgCFCIGRQ0AIAlBFGohAAwBCyAJKAIQIgZFDQQgCUEQaiEACwNAIAAhByAGIgVBFGohACAFKAIUIgYNACAFQRBqIQAgBSgCECIGDQALIAdBADYCAAwKCwJAI4GAgIAAQZykwYAAaigCCCIFIANJDQAjgYCAgABBnKTBgABqKAIUIQQCQAJAIAUgA2siBkEQSQ0AIAQgA2oiACAGQQFyNgIEIAQgBWogBjYCACAEIANBA3I2AgQMAQsgBCAFQQNyNgIEIAQgBWoiBSAFKAIEQQFyNgIEQQAhBkEAIQALI4GAgIAAQZykwYAAaiIFIAY2AgggBSAANgIUIARBCGohBQwMCwJAI4GAgIAAQZykwYAAaigCDCIAIANNDQAgAiADaiIFIAAgA2siBEEBcjYCBCOBgICAAEGcpMGAAGoiBiAFNgIYIAYgBDYCDCACIANBA3I2AgQgAkEIaiEFDAwLAkACQCOBgICAAEH0p8GAAGooAgBFDQAjgYCAgABB9KfBgABqKAIIIQQMAQsjgYCAgAAiBEH0p8GAAGoiBUEANgIUIAVCfzcCDCAFQoCAhICAgMAANwIEIARBnKTBgABqQQA2ArwDIAUgAUEMakFwcUHYqtWqBXM2AgBBgIAEIQQLQQAhBQJAIAQgA0HHAGoiCGoiB0EAIARrIgtxIgkgA0sNACOOgICAAEEwNgIADAwLAkAjgYCAgABBnKTBgABqKAK4AyIERQ0AAkAjgYCAgABBnKTBgABqKAKwAyIGIAlqIgogBk0NACAKIARNDQELI46AgIAAQTA2AgAMDAsjgYCAgABBnKTBgABqLQC8A0EEcQ0FAkACQAJAIAJFDQAjgYCAgABBnKTBgABqQcADaiEEA0ACQCACIAQoAgAiBkkNACACIAYgBCgCBGpJDQMLIAQoAggiBA0ACwtBABD+gYCAACIHQX9GDQYgCSELAkAjgYCAgABB9KfBgABqKAIEIgRBf2oiBiAHcUUNACAJIAdrIAYgB2pBACAEa3FqIQsLI4GAgIAAIQQgCyADTQ0GIAtB/v///wdLDQYgBEGcpMGAAGooArADIQQCQCOBgICAAEGcpMGAAGooArgDIgZFDQAgBCALaiIAIARNDQcgACAGSw0HCyALEP6BgIAAIgQgB0cNAQwICyAHIABrIAtxIgtB/v///wdLDQUgCxD+gYCAACIHIAQoAgAgBCgCBGpGDQQgByEECwJAIAsgA0HIAGpPDQAgBEF/Rg0AAkAgCCALayOBgICAAEH0p8GAAGooAggiBmpBACAGa3EiBkH+////B00NACAEIQcMCAsCQCAGEP6BgIAAQX9GDQAgBiALaiELIAQhBwwIC0EAIAtrEP6BgIAAGgwFCyAEIQcgBEF/Rw0GDAQLAAtBACEFDAgLQQAhBQwGCyAHQX9HDQILI4GAgIAAQZykwYAAaiIEIAQoArwDQQRyNgK8AwsgCUH+////B0sNASAJEP6BgIAAIQdBABD+gYCAACEEIAdBf0YNASAEQX9GDQEgByAETw0BIAQgB2siCyADQThqTQ0BCyOBgICAAEGcpMGAAGoiBCAEKAKwAyALaiIGNgKwAwJAIAYgBCgCtANNDQAjgYCAgABBnKTBgABqIAY2ArQDCwJAAkACQAJAI4GAgIAAQZykwYAAaigCGCIGRQ0AI4GAgIAAQZykwYAAakHAA2ohBANAIAcgBCgCACIAIAQoAgQiCWpGDQIgBCgCCCIEDQAMAwsLAkACQCOBgICAAEGcpMGAAGooAhAiBEUNACAHIARPDQELI4GAgIAAQZykwYAAaiAHNgIQCyOBgICAACIGQZykwYAAaiIEQQA2AswDIAQgCzYCxAMgBCAHNgLAAyAEQX82AiAgBCAGQfSnwYAAaigCADYCJEGAfiEGA0AjgYCAgABBnKTBgABqIAZqIgRBvAJqIARBsAJqIgA2AgAgACAEQagCaiIJNgIAIARBtAJqIAk2AgAgBEHEAmogBEG4AmoiCTYCACAJIAA2AgAgBEHMAmogBEHAAmoiADYCACAAIAk2AgAgBEHIAmogADYCACAGQSBqIgYNAAsgB0F4IAdrQQ9xIgRqIgYgC0FIaiIAIARrIglBAXI2AgQjgYCAgAAiC0GcpMGAAGoiBCALQfSnwYAAaigCEDYCHCAEIAk2AgwgBCAGNgIYIAcgAGpBODYCBAwCCyAGIAdPDQAgBiAASQ0AIAQoAgxBCHENACAGQXggBmtBD3EiB2oiAiOBgICAACIIQZykwYAAaiIAKAIMIAtqIgogB2siB0EBcjYCBCAEIAkgC2o2AgQgACAIQfSnwYAAaigCEDYCHCAAIAI2AhggACAHNgIMIAYgCmpBODYCBAwBCwJAIAcjgYCAgABBnKTBgABqKAIQTw0AI4GAgIAAQZykwYAAaiAHNgIQCyAHIAtqIQAjgYCAgABBnKTBgABqQcADaiEEAkACQANAIAQoAgAiCSAARg0BIAQoAggiBA0ADAILCyAELQAMQQhxRQ0DCyOBgICAAEGcpMGAAGpBwANqIQQCQANAAkAgBiAEKAIAIgBJDQAgBiAAIAQoAgRqIgBJDQILIAQoAgghBAwACwsgB0F4IAdrQQ9xIgRqIgIgC0FIaiIJIARrIghBAXI2AgQgByAJakE4NgIEIAYgAEE3IABrQQ9xakFBaiIEIAQgBkEQakkbIglBIzYCBCOBgICAACIKQZykwYAAaiIEIApB9KfBgABqKAIQNgIcIAQgCDYCDCAEIAI2AhggCSAEKQLIAzcCECAJIAQpAsADNwIIIAQgBzYCwAMgBEEANgLMAyAEIAlBCGo2AsgDIAQgCzYCxAMgCUEkaiEEA0AgBEEHNgIAIARBBGoiBCAASQ0ACyAJIAZGDQAgCSAJKAIEQX5xNgIEIAkgCSAGayIHNgIAIAYgB0EBcjYCBAJAAkAgB0H/AUsNACOBgICAAEGcpMGAAGoiACAHQfgBcWpBKGohBAJAAkAgACgCACIAQQEgB0EDdnQiCXENACOBgICAAEGcpMGAAGogACAJcjYCACAEIQAMAQsgBCgCCCEACyAAIAY2AgwgBCAGNgIIQQwhCUEIIQcMAQtBHyEEAkAgB0H///8HSw0AIAdBJiAHQQh2ZyIEa3ZBAXEgBEEBdHJBPnMhBAsgBiAENgIcIAZCADcCECOBgICAAEGcpMGAAGoiCSAEQQJ0akGwAmohAAJAAkACQCAJKAIEIglBASAEdCILcQ0AIAAgBjYCACOBgICAAEGcpMGAAGogCSALcjYCBCAGIAA2AhgMAQsgB0EAQRkgBEEBdmsgBEEfRht0IQQgACgCACEJA0AgCSIAKAIEQXhxIAdGDQIgBEEddiEJIARBAXQhBCAAIAlBBHFqIgsoAhAiCQ0ACyALQRBqIAY2AgAgBiAANgIYC0EIIQlBDCEHIAYhACAGIQQMAQsgACgCCCEEIAAgBjYCCCAEIAY2AgwgBiAENgIIQQAhBEEYIQlBDCEHCyAGIAdqIAA2AgAgBiAJaiAENgIACyOBgICAAEGcpMGAAGooAgwiBCADTQ0AI4GAgIAAQZykwYAAaiIFKAIYIgYgA2oiACAEIANrIgRBAXI2AgQgBSAENgIMIAUgADYCGCAGIANBA3I2AgQgBkEIaiEFDAQLI46AgIAAQTA2AgAMAwsgBCAHNgIAIAQgBCgCBCALajYCBCAHIAkgAxCBgoCAACEFDAILAkAgC0UNAAJAAkAgCSOBgICAAEGcpMGAAGogCSgCHCIAQQJ0aiIGKAKwAkcNACAGQbACaiAFNgIAIAUNASOBgICAAEGcpMGAAGogCkF+IAB3cSIKNgIEDAILAkACQCALKAIQIAlHDQAgCyAFNgIQDAELIAsgBTYCFAsgBUUNAQsgBSALNgIYAkAgCSgCECIGRQ0AIAUgBjYCECAGIAU2AhgLIAkoAhQiBkUNACAFIAY2AhQgBiAFNgIYCwJAAkAgBEEPSw0AIAkgBCADciIFQQNyNgIEIAkgBWoiBSAFKAIEQQFyNgIEDAELIAkgA2oiACAEQQFyNgIEIAkgA0EDcjYCBCAAIARqIAQ2AgACQCAEQf8BSw0AI4GAgIAAQZykwYAAaiIDIARB+AFxakEoaiEFAkACQCADKAIAIgNBASAEQQN2dCIEcQ0AI4GAgIAAQZykwYAAaiADIARyNgIAIAUhBAwBCyAFKAIIIQQLIAQgADYCDCAFIAA2AgggACAFNgIMIAAgBDYCCAwBC0EfIQUCQCAEQf///wdLDQAgBEEmIARBCHZnIgVrdkEBcSAFQQF0ckE+cyEFCyAAIAU2AhwgAEIANwIQI4GAgIAAQZykwYAAaiAFQQJ0akGwAmohAwJAIApBASAFdCIGcQ0AIAMgADYCACOBgICAAEGcpMGAAGogCiAGcjYCBCAAIAM2AhggACAANgIIIAAgADYCDAwBCyAEQQBBGSAFQQF2ayAFQR9GG3QhBSADKAIAIQYCQANAIAYiAygCBEF4cSAERg0BIAVBHXYhBiAFQQF0IQUgAyAGQQRxaiIHKAIQIgYNAAsgB0EQaiAANgIAIAAgAzYCGCAAIAA2AgwgACAANgIIDAELIAMoAggiBSAANgIMIAMgADYCCCAAQQA2AhggACADNgIMIAAgBTYCCAsgCUEIaiEFDAELAkAgAkUNAAJAAkAgACOBgICAAEGcpMGAAGogACgCHCIJQQJ0aiIGKAKwAkcNACAGQbACaiAFNgIAIAUNASOBgICAAEGcpMGAAGogCkF+IAl3cTYCBAwCCwJAAkAgAigCECAARw0AIAIgBTYCEAwBCyACIAU2AhQLIAVFDQELIAUgAjYCGAJAIAAoAhAiBkUNACAFIAY2AhAgBiAFNgIYCyAAKAIUIgZFDQAgBSAGNgIUIAYgBTYCGAsCQAJAIARBD0sNACAAIAQgA3IiBUEDcjYCBCAAIAVqIgUgBSgCBEEBcjYCBAwBCyAAIANqIgYgBEEBcjYCBCAAIANBA3I2AgQgBiAEaiAENgIAAkAgCEUNACOBgICAAEGcpMGAAGoiBSAIQXhxakEoaiEDIAUoAhQhBQJAAkBBASAIQQN2dCIJIAdxDQAjgYCAgABBnKTBgABqIAkgB3I2AgAgAyEJDAELIAMoAgghCQsgCSAFNgIMIAMgBTYCCCAFIAM2AgwgBSAJNgIICyOBgICAAEGcpMGAAGoiBSAGNgIUIAUgBDYCCAsgAEEIaiEFCyABQRBqJICAgIAAIAUL7QgBB38gAEF4IABrQQ9xaiIDIAJBA3I2AgQgAUF4IAFrQQ9xaiIEIAMgAmoiBWshAAJAAkAgBCOBgICAAEGcpMGAAGooAhhHDQAjgYCAgABBnKTBgABqIgIgBTYCGCACIAIoAgwgAGoiADYCDCAFIABBAXI2AgQMAQsCQCAEI4GAgIAAQZykwYAAaigCFEcNACOBgICAAEGcpMGAAGoiASAFNgIUIAEgASgCCCAAaiICNgIIIAUgAkEBcjYCBCAFIAJqIAI2AgAMAQsCQCAEKAIEIgFBA3FBAUcNACABQXhxIQYgBCgCDCECAkACQCABQf8BSw0AAkAgAiAEKAIIIgdHDQAjgYCAgABBnKTBgABqIgIgAigCAEF+IAFBA3Z3cTYCAAwCCyACIAc2AgggByACNgIMDAELIAQoAhghCAJAAkAgAiAERg0AIAQoAggiASACNgIMIAIgATYCCAwBCwJAAkACQCAEKAIUIgFFDQAgBEEUaiEHDAELIAQoAhAiAUUNASAEQRBqIQcLA0AgByEJIAEiAkEUaiEHIAIoAhQiAQ0AIAJBEGohByACKAIQIgENAAsgCUEANgIADAELQQAhAgsgCEUNAAJAAkAgBCOBgICAAEGcpMGAAGogBCgCHCIHQQJ0aiIBKAKwAkcNACABQbACaiACNgIAIAINASOBgICAAEGcpMGAAGoiAiACKAIEQX4gB3dxNgIEDAILAkACQCAIKAIQIARHDQAgCCACNgIQDAELIAggAjYCFAsgAkUNAQsgAiAINgIYAkAgBCgCECIBRQ0AIAIgATYCECABIAI2AhgLIAQoAhQiAUUNACACIAE2AhQgASACNgIYCyAGIABqIQAgBCAGaiIEKAIEIQELIAQgAUF+cTYCBCAFIABqIAA2AgAgBSAAQQFyNgIEAkAgAEH/AUsNACOBgICAAEGcpMGAAGoiASAAQfgBcWpBKGohAgJAAkAgASgCACIBQQEgAEEDdnQiAHENACOBgICAAEGcpMGAAGogASAAcjYCACACIQAMAQsgAigCCCEACyAAIAU2AgwgAiAFNgIIIAUgAjYCDCAFIAA2AggMAQtBHyECAkAgAEH///8HSw0AIABBJiAAQQh2ZyICa3ZBAXEgAkEBdHJBPnMhAgsgBSACNgIcIAVCADcCECOBgICAAEGcpMGAAGoiByACQQJ0akGwAmohAQJAIAcoAgQiB0EBIAJ0IgRxDQAgASAFNgIAI4GAgIAAQZykwYAAaiAHIARyNgIEIAUgATYCGCAFIAU2AgggBSAFNgIMDAELIABBAEEZIAJBAXZrIAJBH0YbdCECIAEoAgAhBwJAA0AgByIBKAIEQXhxIABGDQEgAkEddiEHIAJBAXQhAiABIAdBBHFqIgQoAhAiBw0ACyAEQRBqIAU2AgAgBSABNgIYIAUgBTYCDCAFIAU2AggMAQsgASgCCCICIAU2AgwgASAFNgIIIAVBADYCGCAFIAE2AgwgBSACNgIICyADQQhqCwoAIAAQg4KAgAALgw4BCH8CQCAARQ0AIABBeGoiASAAQXxqKAIAIgJBeHEiAGohAyOBgICAACEEAkAgAkEBcQ0AIAJBAnFFDQEgASABKAIAIgVrIgEgBEGcpMGAAGooAhBJDQEgBSAAaiEAAkACQAJAAkAgASOBgICAAEGcpMGAAGooAhRGDQAgASgCDCECAkAgBUH/AUsNACACIAEoAggiBEcNAiOBgICAAEGcpMGAAGoiAiACKAIAQX4gBUEDdndxNgIADAULIAEoAhghBgJAIAIgAUYNACABKAIIIgQgAjYCDCACIAQ2AggMBAsCQAJAIAEoAhQiBEUNACABQRRqIQUMAQsgASgCECIERQ0DIAFBEGohBQsDQCAFIQcgBCICQRRqIQUgAigCFCIEDQAgAkEQaiEFIAIoAhAiBA0ACyAHQQA2AgAMAwsgAygCBCICQQNxQQNHDQMgAyACQX5xNgIEIAMgADYCACOBgICAAEGcpMGAAGogADYCCCABIABBAXI2AgQPCyACIAQ2AgggBCACNgIMDAILQQAhAgsgBkUNAAJAAkAgASOBgICAAEGcpMGAAGogASgCHCIFQQJ0aiIEKAKwAkcNACAEQbACaiACNgIAIAINASOBgICAAEGcpMGAAGoiAiACKAIEQX4gBXdxNgIEDAILAkACQCAGKAIQIAFHDQAgBiACNgIQDAELIAYgAjYCFAsgAkUNAQsgAiAGNgIYAkAgASgCECIERQ0AIAIgBDYCECAEIAI2AhgLIAEoAhQiBEUNACACIAQ2AhQgBCACNgIYCyABIANPDQAgAygCBCIEQQFxRQ0AAkACQAJAAkACQCAEQQJxDQACQCADI4GAgIAAQZykwYAAaigCGEcNACOBgICAAEGcpMGAAGoiAiABNgIYIAIgAigCDCAAaiIANgIMIAEgAEEBcjYCBCABIAIoAhRHDQYjgYCAgABBnKTBgABqIgFBADYCCCABQQA2AhQPCwJAIAMjgYCAgABBnKTBgABqKAIUIgZHDQAjgYCAgABBnKTBgABqIgIgATYCFCACIAIoAgggAGoiADYCCCABIABBAXI2AgQgASAAaiAANgIADwsgBEF4cSAAaiEAIAMoAgwhAgJAIARB/wFLDQACQCACIAMoAggiBUcNACOBgICAAEGcpMGAAGoiAiACKAIAQX4gBEEDdndxNgIADAULIAIgBTYCCCAFIAI2AgwMBAsgAygCGCEIAkAgAiADRg0AIAMoAggiBCACNgIMIAIgBDYCCAwDCwJAAkAgAygCFCIERQ0AIANBFGohBQwBCyADKAIQIgRFDQIgA0EQaiEFCwNAIAUhByAEIgJBFGohBSACKAIUIgQNACACQRBqIQUgAigCECIEDQALIAdBADYCAAwCCyADIARBfnE2AgQgASAAaiAANgIAIAEgAEEBcjYCBAwDC0EAIQILIAhFDQACQAJAIAMjgYCAgABBnKTBgABqIAMoAhwiBUECdGoiBCgCsAJHDQAgBEGwAmogAjYCACACDQEjgYCAgABBnKTBgABqIgIgAigCBEF+IAV3cTYCBAwCCwJAAkAgCCgCECADRw0AIAggAjYCEAwBCyAIIAI2AhQLIAJFDQELIAIgCDYCGAJAIAMoAhAiBEUNACACIAQ2AhAgBCACNgIYCyADKAIUIgRFDQAgAiAENgIUIAQgAjYCGAsgASAAaiAANgIAIAEgAEEBcjYCBCABIAZHDQAjgYCAgABBnKTBgABqIAA2AggPCwJAIABB/wFLDQAjgYCAgABBnKTBgABqIgQgAEH4AXFqQShqIQICQAJAIAQoAgAiBEEBIABBA3Z0IgBxDQAjgYCAgABBnKTBgABqIAQgAHI2AgAgAiEADAELIAIoAgghAAsgACABNgIMIAIgATYCCCABIAI2AgwgASAANgIIDwtBHyECAkAgAEH///8HSw0AIABBJiAAQQh2ZyICa3ZBAXEgAkEBdHJBPnMhAgsgASACNgIcIAFCADcCECOBgICAAEGcpMGAAGoiBCACQQJ0akGwAmohBQJAAkACQAJAIAQoAgQiBEEBIAJ0IgNxDQAgBSABNgIAI4GAgIAAQZykwYAAaiAEIANyNgIEQQghAEEYIQIMAQsgAEEAQRkgAkEBdmsgAkEfRht0IQIgBSgCACEFA0AgBSIEKAIEQXhxIABGDQIgAkEddiEFIAJBAXQhAiAEIAVBBHFqIgMoAhAiBQ0ACyADQRBqIAE2AgBBCCEAQRghAiAEIQULIAEhBCABIQMMAQsgBCgCCCIFIAE2AgwgBCABNgIIQQAhA0EYIQBBCCECCyABIAJqIAU2AgAgASAENgIMIAEgAGogAzYCACOBgICAAEGcpMGAAGoiASABKAIgQX9qIgFBfyABGzYCIAsLbAIBfwF+AkACQCAADQBBACECDAELIACtIAGtfiIDpyECIAEgAHJBgIAESQ0AQX8gAiADQiCIp0EARxshAgsCQCACEICCgIAAIgBFDQAgAEF8ai0AAEEDcUUNACACRQ0AIABBACAC/AsACyAAC58JAQt/AkAgAA0AIAEQgIKAgAAPCwJAIAFBQEkNACOOgICAAEEwNgIAQQAPC0EQIAFBE2pBcHEgAUELSRshAiAAQXxqIgMoAgAiBEF4cSEFAkACQAJAIARBA3ENACACQYACSQ0BIAUgAk0NASAFIAJrI4GAgIAAQfSnwYAAaigCCEEBdE0NAgwBCyAAQXhqIgYgBWohBwJAIAUgAkkNACAFIAJrIgFBEEkNAiADIAIgBEEBcXJBAnI2AgAgBiACaiICIAFBA3I2AgQgByAHKAIEQQFyNgIEIAIgARCGgoCAACAADwsgBygCBCEIAkAgByOBgICAAEGcpMGAAGooAhhHDQAjgYCAgABBnKTBgABqKAIMIAVqIgUgAk0NASADIAIgBEEBcXJBAnI2AgAjgYCAgABBnKTBgABqIgEgBiACaiIENgIYIAEgBSACayICNgIMIAQgAkEBcjYCBCAADwsCQCAHI4GAgIAAQZykwYAAaigCFEcNACOBgICAAEGcpMGAAGooAgggBWoiBSACSQ0BAkACQCAFIAJrIgFBEEkNACADIAIgBEEBcXJBAnI2AgAgBiACaiICIAFBAXI2AgQgBiAFaiIFIAE2AgAgBSAFKAIEQX5xNgIEDAELIAMgBEEBcSAFckECcjYCACAGIAVqIgEgASgCBEEBcjYCBEEAIQJBACEBCyOBgICAAEGcpMGAAGoiBSACNgIUIAUgATYCCCAADwsgCEECcQ0AIAhBeHEgBWoiCSACSQ0AIAkgAmshCiAHKAIMIQECQAJAIAhB/wFLDQACQCABIAcoAggiBUcNACOBgICAAEGcpMGAAGoiASABKAIAQX4gCEEDdndxNgIADAILIAEgBTYCCCAFIAE2AgwMAQsgBygCGCELAkACQCABIAdGDQAgBygCCCIFIAE2AgwgASAFNgIIDAELAkACQAJAIAcoAhQiBUUNACAHQRRqIQgMAQsgBygCECIFRQ0BIAdBEGohCAsDQCAIIQwgBSIBQRRqIQggASgCFCIFDQAgAUEQaiEIIAEoAhAiBQ0ACyAMQQA2AgAMAQtBACEBCyALRQ0AAkACQCAHI4GAgIAAQZykwYAAaiAHKAIcIghBAnRqIgUoArACRw0AIAVBsAJqIAE2AgAgAQ0BI4GAgIAAQZykwYAAaiIBIAEoAgRBfiAId3E2AgQMAgsCQAJAIAsoAhAgB0cNACALIAE2AhAMAQsgCyABNgIUCyABRQ0BCyABIAs2AhgCQCAHKAIQIgVFDQAgASAFNgIQIAUgATYCGAsgBygCFCIFRQ0AIAEgBTYCFCAFIAE2AhgLAkAgCkEPSw0AIAMgBEEBcSAJckECcjYCACAGIAlqIgEgASgCBEEBcjYCBCAADwsgAyACIARBAXFyQQJyNgIAIAYgAmoiASAKQQNyNgIEIAYgCWoiAiACKAIEQQFyNgIEIAEgChCGgoCAACAADwsCQCABEICCgIAAIgINAEEADwsCQEF8QXggAygCACIFQQNxGyAFQXhxaiIFIAEgBSABSRsiAUUNACACIAAgAfwKAAALIAAQg4KAgAAgAiEACyAAC5wNAQd/IAAgAWohAgJAAkAgACgCBCIDQQFxDQAgA0ECcUUNASAAKAIAIgQgAWohAQJAAkACQAJAIAAgBGsiACOBgICAAEGcpMGAAGooAhRGDQAgACgCDCEDAkAgBEH/AUsNACADIAAoAggiBUcNAiOBgICAAEGcpMGAAGoiAyADKAIAQX4gBEEDdndxNgIADAULIAAoAhghBgJAIAMgAEYNACAAKAIIIgQgAzYCDCADIAQ2AggMBAsCQAJAIAAoAhQiBEUNACAAQRRqIQUMAQsgACgCECIERQ0DIABBEGohBQsDQCAFIQcgBCIDQRRqIQUgAygCFCIEDQAgA0EQaiEFIAMoAhAiBA0ACyAHQQA2AgAMAwsgAigCBCIDQQNxQQNHDQMgAiADQX5xNgIEIAIgATYCACOBgICAAEGcpMGAAGogATYCCCAAIAFBAXI2AgQPCyADIAU2AgggBSADNgIMDAILQQAhAwsgBkUNAAJAAkAgACOBgICAAEGcpMGAAGogACgCHCIFQQJ0aiIEKAKwAkcNACAEQbACaiADNgIAIAMNASOBgICAAEGcpMGAAGoiAyADKAIEQX4gBXdxNgIEDAILAkACQCAGKAIQIABHDQAgBiADNgIQDAELIAYgAzYCFAsgA0UNAQsgAyAGNgIYAkAgACgCECIERQ0AIAMgBDYCECAEIAM2AhgLIAAoAhQiBEUNACADIAQ2AhQgBCADNgIYCwJAAkACQAJAAkAgAigCBCIEQQJxDQACQCACI4GAgIAAQZykwYAAaigCGEcNACOBgICAAEGcpMGAAGoiAyAANgIYIAMgAygCDCABaiIBNgIMIAAgAUEBcjYCBCAAIAMoAhRHDQYjgYCAgABBnKTBgABqIgBBADYCCCAAQQA2AhQPCwJAIAIjgYCAgABBnKTBgABqKAIUIgZHDQAjgYCAgABBnKTBgABqIgMgADYCFCADIAMoAgggAWoiATYCCCAAIAFBAXI2AgQgACABaiABNgIADwsgBEF4cSABaiEBIAIoAgwhAwJAIARB/wFLDQACQCADIAIoAggiBUcNACOBgICAAEGcpMGAAGoiAyADKAIAQX4gBEEDdndxNgIADAULIAMgBTYCCCAFIAM2AgwMBAsgAigCGCEIAkAgAyACRg0AIAIoAggiBCADNgIMIAMgBDYCCAwDCwJAAkAgAigCFCIERQ0AIAJBFGohBQwBCyACKAIQIgRFDQIgAkEQaiEFCwNAIAUhByAEIgNBFGohBSADKAIUIgQNACADQRBqIQUgAygCECIEDQALIAdBADYCAAwCCyACIARBfnE2AgQgACABaiABNgIAIAAgAUEBcjYCBAwDC0EAIQMLIAhFDQACQAJAIAIjgYCAgABBnKTBgABqIAIoAhwiBUECdGoiBCgCsAJHDQAgBEGwAmogAzYCACADDQEjgYCAgABBnKTBgABqIgMgAygCBEF+IAV3cTYCBAwCCwJAAkAgCCgCECACRw0AIAggAzYCEAwBCyAIIAM2AhQLIANFDQELIAMgCDYCGAJAIAIoAhAiBEUNACADIAQ2AhAgBCADNgIYCyACKAIUIgRFDQAgAyAENgIUIAQgAzYCGAsgACABaiABNgIAIAAgAUEBcjYCBCAAIAZHDQAjgYCAgABBnKTBgABqIAE2AggPCwJAIAFB/wFLDQAjgYCAgABBnKTBgABqIgQgAUH4AXFqQShqIQMCQAJAIAQoAgAiBEEBIAFBA3Z0IgFxDQAjgYCAgABBnKTBgABqIAQgAXI2AgAgAyEBDAELIAMoAgghAQsgASAANgIMIAMgADYCCCAAIAM2AgwgACABNgIIDwtBHyEDAkAgAUH///8HSw0AIAFBJiABQQh2ZyIDa3ZBAXEgA0EBdHJBPnMhAwsgACADNgIcIABCADcCECOBgICAAEGcpMGAAGoiBSADQQJ0akGwAmohBAJAIAUoAgQiBUEBIAN0IgJxDQAgBCAANgIAI4GAgIAAQZykwYAAaiAFIAJyNgIEIAAgBDYCGCAAIAA2AgggACAANgIMDwsgAUEAQRkgA0EBdmsgA0EfRht0IQMgBCgCACEFAkADQCAFIgQoAgRBeHEgAUYNASADQR12IQUgA0EBdCEDIAQgBUEEcWoiAigCECIFDQALIAJBEGogADYCACAAIAQ2AhggACAANgIMIAAgADYCCA8LIAQoAggiASAANgIMIAQgADYCCCAAQQA2AhggACAENgIMIAAgATYCCAsLeAECfwJAAkACQCABQRBHDQAgAhCAgoCAACEBDAELQRwhAyABQQNxDQEgAUECdiIERQ0BIARpQQFLDQECQCACQUAgAWtNDQBBMA8LIAFBECABQRBLGyACEIiCgIAAIQELAkAgAQ0AQTAPCyAAIAE2AgBBACEDCyADC60DAQV/AkACQCAAQRAgAEEQSxsiAiACQX9qcQ0AIAIhAAwBC0EgIQMDQCADIgBBAXQhAyAAIAJJDQALCwJAIAFBQCAAa0kNACOOgICAAEEwNgIAQQAPCwJAIABBECABQRNqQXBxIAFBC0kbIgFqQQxqEICCgIAAIgMNAEEADwsgA0F4aiECAkACQCAAQX9qIANxDQAgAiEADAELIANBfGoiBCgCACIFQXhxIAMgAGpBf2pBACAAa3FBeGoiA0EAIAAgAyACa0EPSxtqIgAgAmsiA2shBgJAIAVBA3ENACAAIAY2AgQgACACKAIAIANqNgIADAELIAAgBiAAKAIEQQFxckECcjYCBCAAIAZqIgYgBigCBEEBcjYCBCAEIAMgBCgCAEEBcXJBAnI2AgAgAiADaiIGIAYoAgRBAXI2AgQgAiADEIaCgIAACwJAIAAoAgQiA0EDcUUNACADQXhxIgIgAUEQak0NACAAIAEgA0EBcXJBAnI2AgQgACABaiIDIAIgAWsiAUEDcjYCBCAAIAJqIgIgAigCBEEBcjYCBCADIAEQhoKAgAALIABBCGoLAgALHAACQCAARQ0AIAAgARCMgoCAAAALEI6CgIAAAAuQAQACQAJAIANBAE4NAEEBIQFBBCECQQAhAwwBCwJAAkACQAJAIAFFDQAgAiABQQEgAxC3gICAACEBDAELAkAgAw0AQQEhAQwCCxC5gICAACADQQEQtYCAgAAhAQsgAQ0AQQEhASAAQQE2AgQMAQsgACABNgIEQQAhAQtBCCECCyAAIAJqIAM2AgAgACABNgIACw0AIAEgABDggICAAAAL5QEBBH8jgICAgABBEGsiAiSAgICAAAJAAkACQCABKAIAIgMgASgCCCIERw0AIAJBBGogBCABKAIEIARBAWoiAxCLgoCAACACKAIEQQFGDQEgASACKAIINgIECyABKAIEIgUgBGpBADoAAAJAAkAgAyAEQQFqIgFLDQAgBSEEDAELAkAgAQ0AQQEhBCAFIANBARC2gICAAAwBCyAFIANBASABELeAgIAAIgRFDQILIAAgATYCBCAAIAQ2AgAgAkEQaiSAgICAAA8LIAIoAgggAigCDBCKgoCAAAALQQEgARCKgoCAAAALJQEBfyOBgICAACIAQfrywIAAakEjIABB1JjBgABqEJaCgIAAAAtoAQJ/AkACQAJAIAEoAggiAg0AQQEhAQwBCyABKAIEIQMQuYCAgAAgAkEBELWAgIAAIgFFDQEgAkUNACABIAMgAvwKAAALIAAgAjYCCCAAIAE2AgQgACACNgIADwtBASACEIqCgIAAAAv5AgEEfyOAgICAAEEgayIDJICAgIAAQQAhBAJAIAJBAWoiBUEASA0AELmAgIAAQQEhBCAFQQEQtYCAgAAiBkUNAAJAAkAgAkUNAAJAIAJFDQAgBiABIAL8CgAACwJAAkAgAkEISQ0AIANBCGpBACABIAIQsYKAgAAgAygCCEEBcUUNAiADKAIMIQQMAQsCQCABLQAADQBBACEEDAELQQEhBCACQQFGDQEgAS0AAUUNAEECIQQgAkECRg0BIAEtAAJFDQBBAyEEIAJBA0YNASABLQADRQ0AQQQhBCACQQRGDQEgAS0ABEUNAEEFIQQgAkEFRg0BIAEtAAVFDQBBBiEEIAJBBkYNASABLQAGDQELIAAgBDYCDCAAIAI2AgggACAGNgIEIAAgBTYCAAwBCyADIAI2AhwgAyAGNgIYIAMgBTYCFCADIANBFGoQjYKAgAAgACADKQMANwIEIABBfzYCAAsgA0EgaiSAgICAAA8LIAQgBRCKgoCAAAAL1wICAX8BfiOAgICAAEHAAGsiCCSAgICAACAIIAI2AgQgCCABNgIAIAggBDYCDCAIIAM2AgggCCOBgICAACICQfyPwYAAaiAAQf8BcSIBai0AADYCFCAIIAJBtJnBgABqIAFBAnRqKAIANgIQAkAgBUUNACAIIAY2AhwgCCAFNgIYIAgjmYCAgACtQiCGIAhBGGqthDcDKCAII4KAgIAAIgVBwYCAgABqrUIghiIJIAhBCGqthDcDOCAIIAkgCK2ENwMwIAggBUHCgICAAGqtQiCGIAhBEGqthDcDICOBgICAAEG1g8CAAGogCEEgaiAHEJaCgIAAAAsgCCOCgICAACIFQcGAgIAAaq1CIIYiCSAIQQhqrYQ3AzAgCCAJIAithDcDKCAIIAVBwoCAgABqrUIghiAIQRBqrYQ3AyAjgYCAgABB/oLAgABqIAhBIGogBxCWgoCAAAALFQAgACABQQF0QQFyIAIQloKAgAAAC+cCBQJ/An4BfwF+An8jgICAgABBIGsiAiSAgICAAEEUIQMgACkDACIEIQUCQCAEQugHVA0AQRQhAyAEIQUDQCACQQxqIANqIgBBfGojgYCAgABB34fBgABqIgYgBSIHIAdCkM4AgCIFQpDOAH59pyIIQf//A3FB5ABuIglBAXRqLwAAOwAAIABBfmogBiAIIAlB5ABsa0H//wNxQQF0ai8AADsAACADQXxqIQMgB0L/rOIEVg0ACwsCQCAFQglYDQAgAkEMaiADQX5qIgNqI4GAgIAAQd+HwYAAaiAFpyIAIABB//8DcUHkAG4iAEHkAGxrQf//A3FBAXRqLwAAOwAAIACtIQULAkACQCAEUA0AIAVQDQELIAJBDGogA0F/aiIDaiOBgICAAEHfh8GAAGogBadBAXRqLQABOgAACyABQQFBAUEAIAJBDGogA2pBFCADaxChgoCAACEDIAJBIGokgICAgAAgAwsUACABIAAoAgAgACgCBBCkgoCAAAv0BAEIfyOAgICAAEEQayIEJICAgIAAAkACQAJAIANBAXENACACLQAAIgUNAUEAIQUMAgsgACACIANBAXYgASgCDBGCgICAAICAgIAAIQUMAQsgASgCDCEGQQAhBwNAIAJBAWohCAJAAkACQAJAAkAgBcBBf0oNACAFQf8BcSIJQYABRg0BIAlBwAFHDQMgBCABNgIEIAQgADYCACAEQqCAgIAGNwIIIAMgB0EDdGoiBSgCACAEIAUoAgQRhICAgACAgICAAEUNAkEBIQUMBgsCQCAAIAggBUH/AXEiBSAGEYKAgIAAgICAgAANACAIIAVqIQIMBAtBASEFDAULAkAgACACQQNqIgUgAi8AASICIAYRgoCAgACAgICAAA0AIAUgAmohAgwDC0EBIQUMBAsgB0EBaiEHIAghAgwBC0GggICABiEKAkAgBUEBcUUNACACQQVqIQggAigAASEKC0EAIQkCQAJAIAVBAnENAEEAIQsgCCECDAELIAhBAmohAiAILwAAIQsLAkACQCAFQQRxDQAgAiEIDAELIAJBAmohCCACLwAAIQkLAkACQCAFQQhxDQAgCCECDAELIAhBAmohAiAILwAAIQcLAkAgBUEQcUUNACADIAtB//8DcUEDdGovAQQhCwsCQCAFQSBxRQ0AIAMgCUH//wNxQQN0ai8BBCEJCyAEIAk7AQ4gBCALOwEMIAQgCjYCCCAEIAE2AgQgBCAANgIAAkAgAyAHQQN0aiIFKAIAIAQgBSgCBBGEgICAAICAgIAARQ0AQQEhBQwDCyAHQQFqIQcLIAItAAAiBQ0AC0EAIQULIARBEGokgICAgAAgBQtHAQF/I4CAgIAAQSBrIgMkgICAgAAgAyABNgIQIAMgADYCDCADQQE7ARwgAyACNgIYIAMgA0EMajYCFCADQRRqEN6AgIAAAAvpAgIBfwF+I4CAgIAAQSBrIgQkgICAgAACQAJAAkAgACACSw0AIAEgAksNASOJgICAAK1CIIYhBSAAIAFNDQIgBCAANgIIIAQgATYCDCAEIAUgBEEMaq2ENwMYIAQgBSAEQQhqrYQ3AxAjgYCAgABBkIDAgABqIARBEGogAxCWgoCAAAALIAQgADYCCCAEIAI2AgwgBCOJgICAAK1CIIYiBSAEQQxqrYQ3AxggBCAFIARBCGqthDcDECOBgICAAEGOgsCAAGogBEEQaiADEJaCgIAAAAsgBCABNgIIIAQgAjYCDCAEI4mAgIAArUIghiIFIARBDGqthDcDGCAEIAUgBEEIaq2ENwMQI4GAgIAAQceCwIAAaiAEQRBqIAMQloKAgAAACyAEIAE2AgggBCACNgIMIAQgBSAEQQxqrYQ3AxggBCAFIARBCGqthDcDECOBgICAAEHHgsCAAGogBEEQaiADEJaCgIAAAAtsAQF/QQEhAQJAAkAgAEH4BkkNACAAQf7/D0kNASAAQYGAOEYNACAAQeD/R2pB4ABJDQAgAEGA/kdqQfABSQ0AIABBgIBEakH+/wNJDQAgAEGAgEBqQf7/A0khAQsgAQ8LIAAQmYKAgABBAXML7AIBBX9BACEBI4GAgIAAQaiLwYAAaiICIAJBAEEeIABB/OUGSRsiAyADQQ9qIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQdqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQRqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkG1CyEEAkACQCADQTpLDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEGL9cCAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELwQUBAn8jgICAgABBEGsiBCSAgICAAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAQ4oBgEBAQEBAQEBBAMBAQUBAQEBAQEBAQEBAQEBAQEBAQEBAQgBAQEBBwALIAFB3ABGDQELIAFBYGpB3wBJDQsgAUH+//8AcUGe/wNGDQsgAUEgSQ0KIAFBgX9qQSFJDQogAUGAwHxqQYAySQ0KIAFBgIBEakH+/wNJDQogAUEgRg0KIAFBgIBAakH+/wNJDQogAUGFAUkNCSABEJuCgIAADQogAUGABkkNByABEJyCgIAARQ0IDAoLIABCADcBAiAAQdy4ATsBAAwMCyAAQgA3AQIgAEHc3AE7AQAMCwsgAEIANwECIABB3OgBOwEADAoLIABCADcBAiAAQdzkATsBAAwJCyAAQgA3AQIgAEHc4AA7AQAMCAsgAkUNBSAAQgA3AQIgAEHczgA7AQAMBwsgAw0FDAQLIAFBrQFJDQELIAEQnYKAgAANASABEJ6CgIAADQELIAEQmIKAgAANAQsgBEEAOgAIIARBADsBBiAEI4GAgIAAQZmHwYAAaiICIAFBFHZqLQAAOgAJIAQgAiABQQR2QQ9xai0AADoADSAEIAIgAUEIdkEPcWotAAA6AAwgBCACIAFBDHZBD3FqLQAAOgALIAQgAiABQRB2QQ9xai0AADoACiAEQQZqIAFBAXJnQQJ2IgNqIgVB+wA6AAAgBUF/akH1ADoAACAEQQZqIANBfmoiA2pB3AA6AAAgACAEKQEGNwIAIARB/QA6AA8gBCACIAFBD3FqLQAAOgAOIAAgBC8BDjsBCEEKIQEMAwsgACABNgIAQYEBIQFBgAEhAwwCCyAAQgA3AQIgAEHcxAA7AQALQQIhAUEAIQMLIAAgAToADSAAIAM6AAwgBEEQaiSAgICAAAuJAQECf0EAIQECQAJAAkACQAJAIABBCHYiAkFqag4bAAQEBAQEBAQEBAMEBAQEBAQEBAQEBAQEBAQBAgsgAEGALUYhAQwDCyAAQYDgAEYhAQwCCyACDQEjmoCAgAAgAEH/AXFqLQAAIQEMAQsjmoCAgAAgAEH/AXFqLQAAQQJxQQF2IQELIAFBAXEL7AIBBX9BACEBI4GAgIAAQZiNwYAAaiICIAJBAEEQIABBq50ESRsiAyADQQhyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQRyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkGLBiEEAkACQCADQR9LDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEHAgMGAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELrwIBBX9BACEBI4GAgIAAQZyOwYAAaiICIAJBAEEGIABBgPwDSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkEjIQQCQAJAIANBCksNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQcuGwYAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuvAgEFf0EAIQEjgYCAgABBzI7BgABqIgIgAkEAQQUgAEG9oQRJGyIDIANBA2oiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDIANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQSshBAJAAkAgA0EJSw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABB7obBgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC2YCAX8BfiOAgICAAEEgayIDJICAgIAAIAMgATYCDCADIAA2AgggAyOJgICAAK1CIIYiBCADQQhqrYQ3AxggAyAEIANBDGqthDcDECOBgICAAEHfgMCAAGogA0EQaiACEJaCgIAAAAuqAwEEfwJAAkACQAJAAkACQAJAIAJBB0sNACACRQ0FIAEtAAANAUEAIQMMBgsgAUEDakF8cSIEIAFGDQEgBCABayEEQQAhAwNAIAEgA2otAABFDQYgBCADQQFqIgNHDQALIAQgAkF4aiIFSw0DDAILQQEhAyACQQFGDQMgAS0AAUUNBEECIQMgAkECRg0DIAEtAAJFDQRBAyEDIAJBA0YNAyABLQADRQ0EQQQhAyACQQRGDQMgAS0ABEUNBEEFIQMgAkEFRg0DIAEtAAVFDQRBBiEDIAJBBkYNAyABLQAGDQMMBAsgAkF4aiEFQQAhBAsDQEGAgoQIIAEgBGoiAygCACIGayAGckGAgoQIIANBBGooAgAiA2sgA3JxQYCBgoR4cUGAgYKEeEcNASAEQQhqIgQgBU0NAAsLIAIgBEYNAANAAkAgASAEai0AAA0AIAQhAwwDCyACIARBAWoiBEcNAAsLIABBATYCBCAAQQE2AgAPCwJAIANBAWogAkYNACAAIAM2AgggAEEANgIEIABBATYCAA8LIAAgAjYCCCAAIAE2AgQgAEEANgIAC9UGAgh/AX4CQAJAIAENACAFQQFqIQYgACgCCCEHQS0hCAwBC0ErQX8gACgCCCIHQYCAgAFxIgEbIQggAUEVdiAFaiEGCwJAAkAgB0GAgIAEcQ0AQQAhAgwBCwJAAkAgA0EQSQ0AIAIgAxCigoCAACEBDAELAkAgAw0AQQAhAQwBCyADQQNxIQlBACEKQQAhAQJAIANBBEkNACADQQxxIQtBACEKQQAhAQNAIAEgAiAKaiIMLAAAQb9/SmogDEEBaiwAAEG/f0pqIAxBAmosAABBv39KaiAMQQNqLAAAQb9/SmohASALIApBBGoiCkcNAAsgCUUNAQsgAiAKaiEMA0AgASAMLAAAQb9/SmohASAMQQFqIQwgCUF/aiIJDQALCyABIAZqIQYLAkACQAJAAkACQAJAAkACQAJAAkAgBiAALwEMIgxPDQAgB0GAgIAIcQ0EIAwgBmshDUEAIQYgB0EddkEDcQ4EAwECAQMLIAAoAgAiASAAKAIEIgwgCCACIAMQo4KAgABFDQdBAQ8LIA0hBgwBCyANQf7/A3FBAXYhBgsgB0H///8AcSEJIAAoAgQhCyAAKAIAIQwgBkH//wNxIgpFDQEgCygCECEAQQAhAUEBIQcDQCAMIAkgABGEgICAAICAgIAADQYgAUEBaiIBQf//A3EgCk8NAgwACwsgACAAKQIIIg6nQYCAgP95cUGwgICAAnI2AghBASEHIAAoAgAiCSAAKAIEIgsgCCACIAMQo4KAgAANBCAMIAZB//8DcUYNAiALKAIQIQpBACEBIAwgBmtB//8DcSEMDAELQQEhByAMIAsgCCACIAMQo4KAgAANAyAMIAQgBSALKAIMEYKAgIAAgICAgAANAwJAIA1B//8DcSAGQf//A3FHDQBBAA8LIAsoAhAhCkEAIQEgDSAGa0H//wNxIQADQCAMIAkgChGEgICAAICAgIAAIgcNBCABQQFqIgFB//8DcSAASQ0ADAQLCwJAA0AgCUEwIAoRhICAgACAgICAAA0BIAFBAWoiAUH//wNxIAxPDQIMAAsLQQEPCyAJIAQgBSALKAIMEYKAgIAAgICAgAANASAAIA43AghBAA8LIAEgBCAFIAwoAgwRgoCAgACAgICAACEHCyAHC+sGAQh/AkACQCABIABBA2pBfHEiAiAAayIDSQ0AIAEgA2siBEECdiIFRQ0AIARBA3EhBkEAIQdBACEBAkAgAiAARg0AQQAhCEEAIQECQCAAIAJrIglBfEsNAEEAIQhBACEBA0AgASAAIAhqIgIsAABBv39KaiACQQFqLAAAQb9/SmogAkECaiwAAEG/f0pqIAJBA2osAABBv39KaiEBIAhBBGoiCA0ACwsgACAIaiECA0AgASACLAAAQb9/SmohASACQQFqIQIgCUEBaiIJDQALCyAAIANqIQkCQCAGRQ0AIAkgBEH8////B3FqIgIsAABBv39KIQcgBkEBRg0AIAcgAiwAAUG/f0pqIQcgBkECRg0AIAcgAiwAAkG/f0pqIQcLIAcgAWohCANAIAkhAyAFRQ0CIAVBwAEgBUHAAUkbIgdBA3EhBgJAAkAgB0ECdCIEQfAHcSIBDQBBACECDAELIAMgAWohAEEAIQIgAyEBA0AgAUEMaigCACIJQX9zQQd2IAlBBnZyQYGChAhxIAFBCGooAgAiCUF/c0EHdiAJQQZ2ckGBgoQIcSABQQRqKAIAIglBf3NBB3YgCUEGdnJBgYKECHEgASgCACIJQX9zQQd2IAlBBnZyQYGChAhxIAJqampqIQIgAUEQaiIBIABHDQALCyAFIAdrIQUgAyAEaiEJIAJBCHZB/4H8B3EgAkH/gfwHcWpBgYAEbEEQdiAIaiEIIAZFDQALIAMgB0H8AXFBAnRqIgIoAgAiAUF/c0EHdiABQQZ2ckGBgoQIcSEBAkAgBkEBRg0AIAIoAgQiCUF/c0EHdiAJQQZ2ckGBgoQIcSABaiEBIAZBAkYNACACKAIIIgJBf3NBB3YgAkEGdnJBgYKECHEgAWohAQsgAUEIdkH/gRxxIAFB/4H8B3FqQYGABGxBEHYgCGohCAwBCwJAIAENAEEADwsgAUEDcSECQQAhCUEAIQgCQCABQQRJDQAgAUF8cSEFQQAhCEEAIQkDQCAIIAAgCWoiASwAAEG/f0pqIAFBAWosAABBv39KaiABQQJqLAAAQb9/SmogAUEDaiwAAEG/f0pqIQggBSAJQQRqIglHDQALIAJFDQELIAAgCWohAQNAIAggASwAAEG/f0pqIQggAUEBaiEBIAJBf2oiAg0ACwsgCAtGAAJAIAJBf0YNACAAIAIgASgCEBGEgICAAICAgIAARQ0AQQEPCwJAIAMNAEEADwsgACADIAQgASgCDBGCgICAAICAgIAAC7oFAQh/AkACQCAAKAIIIgNBgICAwAFxRQ0AAkACQAJAAkACQCADQYCAgIABcUUNACAALwEOIgQNAUEAIQIMAgsCQCACQRBJDQAgASACEKKCgIAAIQUMBAsCQCACDQBBACEFDAQLIAJBA3EhBkEAIQdBACEFAkAgAkEESQ0AIAJBDHEhBEEAIQVBACEHA0AgBSABIAdqIggsAABBv39KaiAIQQFqLAAAQb9/SmogCEECaiwAAEG/f0pqIAhBA2osAABBv39KaiEFIAQgB0EEaiIHRw0ACyAGRQ0ECyABIAdqIQgDQCAFIAgsAABBv39KaiEFIAhBAWohCCAGQX9qIgYNAAwECwsgASACaiEHQQAhAiABIQggBCEGA0AgCCIFIAdGDQICQAJAIAUsAAAiCEF/TA0AIAVBAWohCAwBCwJAIAhBYE8NACAFQQJqIQgMAQsgBUEEQQMgCEFvSxtqIQgLIAggBWsgAmohAiAGQX9qIgYNAAsLQQAhBgsgBCAGayEFCyAFIAAvAQwiCE8NACAIIAVrIQlBACEEAkACQAJAIANBHXZBA3EOBAIAAQICCyAJIQQMAQsgCUH+/wNxQQF2IQQLIANB////AHEhBiAAKAIEIQogACgCACEIAkAgBEH//wNxIgdFDQAgCigCECEDQQAhBUEBIQADQCAIIAYgAxGEgICAAICAgIAADQMgBUEBaiIFQf//A3EgB0kNAAsLAkAgCCABIAIgCigCDBGCgICAAICAgIAARQ0AQQEPCwJAIAlB//8DcSAEQf//A3FHDQBBAA8LIAooAhAhAkEAIQUgCSAEa0H//wNxIQcDQCAIIAYgAhGEgICAAICAgIAAIgANAiAFQQFqIgVB//8DcSAHTw0CDAALCyAAKAIAIAEgAiAAKAIEKAIMEYKAgIAAgICAgAAhAAsgAAseACAAKAIAIAEgAiAAKAIEKAIMEYKAgIAAgICAgAAL3gIBCH8jgICAgABBEGsiAiSAgICAAEEKIQMgACgCACIEIQUCQCAEQegHSQ0AQQohAyAEIQUDQCACQQZqIANqIgZBfGojgYCAgABB34fBgABqIgcgBSIAIABBkM4AbiIFQZDOAGxrIghB//8DcUHkAG4iCUEBdGovAAA7AAAgBkF+aiAHIAggCUHkAGxrQf//A3FBAXRqLwAAOwAAIANBfGohAyAAQf+s4gRLDQALCwJAAkAgBUEJSw0AIAUhAAwBCyACQQZqIANBfmoiA2ojgYCAgABB34fBgABqIAUgBUH//wNxQeQAbiIAQeQAbGtB//8DcUEBdGovAAA7AAALAkACQCAERQ0AIABFDQELIAJBBmogA0F/aiIDaiOBgICAAEHfh8GAAGogAEEBdGotAAE6AAALIAFBAUEBQQAgAkEGaiADakEKIANrEKGCgIAAIQMgAkEQaiSAgICAACADCxMAIAAgASACIAMgBBCogoCAAAAL/woCBH8BfiOAgICAAEEwayIFJICAgIAAIAUgAzYCBCAFIAI2AgAgBSABNgIIAkACQAJAAkACQAJAAkACQCACIAFLIgYNACADIAFLIgcNASACIANLDQIgAkUNBCACIAFPDQQgACACaiwAAEG/f0oNBAJAIAAgAkF/aiIIaiwAAEG/f0oNACACQX5qIgMgAkF9aiAAIANqLAAAQb9/ShshCAsgASACQQFqIgMgASADSxshByACIAEgBhshAwNAAkACQCADIAJGDQAgACACaiwAAEG/f0wNAQwGCyADIAEjgYCAgABB5JjBgABqEJ+CgIAAAAsgAkEBaiICIAFJDQALIAchAgwDCyAFI4mAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQZaBwIAAaiAFQRhqIAQQloKAgAAACyAFI4mAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBUEEaq2ENwMYI4GAgIAAQdOBwIAAaiAFQRhqIAQQloKAgAAACyAFI4mAgIAArUIghiIJIAVBBGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQbiAwIAAaiAFQRhqIAQQloKAgAAACyAFIAg2AgwgBSACNgIQAkAgCCACSw0AIAIgAUsNAAJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAgsgAiABRg0AIAAgAmosAABBv39MDQELIAggAkYNAgJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSObgICAAK1CIIYgBUEUaq2ENwMgIAUjiYCAgACtQiCGIAWthDcDGCAFI4KAgIAAQcSAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQf+OwIAAaiAFQRhqIAQQloKAgAAACyAAIAEgCCACIAQQp4KAgAAACyADRQ0CIAMgAU8NAiAAIANqLAAAQb9/Sg0CAkAgACADQX9qIghqLAAAQb9/Sg0AIANBfmoiAiADQX1qIAAgAmosAABBv39KGyEICyABIANBAWoiAiABIAJLGyEGIAMgASAHGyECAkADQAJAAkAgAiADRg0AIAAgA2osAABBv39MDQEMAwsgAiABI4GAgIAAQeSYwYAAahCfgoCAAAALIANBAWoiAyABSQ0ACyAGIQMLIAUgCDYCDCAFIAM2AhAgCCADSw0BIAMgAUsNAQJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAwsgAyABRg0AIAAgA2osAABBv39MDQILIAggA0YNAAJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSObgICAAK1CIIYgBUEUaq2ENwMgIAUjiYCAgACtQiCGIAVBBGqthDcDGCAFI4KAgIAAQcSAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQdGPwIAAaiAFQRhqIAQQloKAgAAACyAEEKuCgIAAAAsgACABIAggAyAEEKeCgIAAAAsgBSOJgICAAK1CIIYiCSAFQQhqrYQ3AyAgBSAJIAVBBGqthDcDGCOBgICAAEHTgcCAAGogBUEYaiAEEJaCgIAAAAvCAQEFfyOAgICAAEEQayICJICAgIAAQQEhAwJAIAEoAgAiBEEnIAEoAgQiBSgCECIBEYSAgIAAgICAgAANAEEBIQMgAiAAKAIAQQFBABCagoCAAAJAAkAgAi0ADSIAQYEBSQ0AIAQgAigCACABEYSAgIAAgICAgABFDQEMAgsgBCACIAItAAwiBmogACAGayAFKAIMEYKAgIAAgICAgAANAQsgBEEnIAERhICAgACAgICAACEDCyACQRBqJICAgIAAIAMLhgUBA38jgICAgABBEGsiAiSAgICAAAJAAkACQAJAIAEoAggiA0GAgIAQcQ0AIANBgICAIHENASAAIAEQpoKAgABFDQJBASEEDAMLIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQZmHwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABByY/BgABqQQIgAkEIaiADakEIakEAIANrEKGCgIAARQ0BDAILIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQcuPwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABByY/BgABqQQIgAkEIaiADakEIakEAIANrEKGCgIAADQELI4GAgIAAIQMCQCABKAIAIANBx4/BgABqQQIgASgCBCgCDBGCgICAAICAgIAARQ0AQQEhBAwBCyAAQQRqIQMCQAJAIAEoAggiBEGAgIAQcQ0AIARBgICAIHENASADIAEQpoKAgAAhBAwCCyADKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEGZh8GAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0ACyABQQEjgYCAgABByY/BgABqQQIgAkEIaiADakEIakEAIANrEKGCgIAAIQQMAQsgAygCACEEQQAhAwNAIAJBCGogA2pBB2ojgYCAgABBy4/BgABqIARBD3FqLQAAOgAAIANBf2ohAyAEQQR2IgQNAAsgAUEBI4GAgIAAQcmPwYAAakECIAJBCGogA2pBCGpBACADaxChgoCAACEECyACQRBqJICAgIAAIAQLGgAjgYCAgABBqYfBgABqQSsgABCSgoCAAAALQwEBfyOAgICAAEEQayIBJICAgIAAIAEjnICAgACtQiCGIAFBD2qthDcDACOBgICAAEHug8CAAGogASAAEJaCgIAAAAsZACABI4GAgIAAQeSPwYAAakEYEKSCgIAAC1gBAX8jgICAgABBEGsiAySAgICAACADIAE2AgQgAyAANgIAIAMjgoCAgABBwoCAgABqrUIghiADrYQ3AwgjgYCAgABB7oPAgABqIANBCGogAhCWgoCAAAALHAAgACgCACABIAAoAgQoAgwRhICAgACAgICAAAscACABKAIAIAEoAgQgACgCACAAKAIEEJWCgIAAC6YCAQV/AkACQAJAAkAgAkEDakF8cSIEIAJHDQAgA0F4aiEFQQAhBAwBCyAEIAJrIgQgAyAEIANJGyEEAkAgA0UNAEEAIQYgAUH/AXEhB0EBIQgDQCACIAZq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dW5kcyBmb3Igc3RyaW5nIG9mIGxlbmd0aCDAABJyYW5nZSBzdGFydCBpbmRleCDAIiBvdXQgb2YgcmFuZ2UgZm9yIHNsaWNlIG9mIGxlbmd0aCDAABByYW5nZSBlbmQgaW5kZXggwCIgb3V0IG9mIHJhbmdlIGZvciBzbGljZSBvZiBsZW5ndGggwAAQYXNzZXJ0aW9uIGBsZWZ0IMAXIHJpZ2h0YCBmYWlsZWQKICBsZWZ0OiDACQogcmlnaHQ6IMAAEGFzc2VydGlvbiBgbGVmdCDAECByaWdodGAgZmFpbGVkOiDACQogIGxlZnQ6IMAJCiByaWdodDogwAAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL2lvL2Vycm9yL3VuaXgucnMAL2NhcmdvL3JlZ2lzdHJ5LzI1Y2RkNTdmYWU5ZjA0NjIvaGFzaGJyb3duLTAuMTcuMS9zcmMvcmF3LnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy9zeXMvdGhyZWFkX2xvY2FsL2Rlc3RydWN0b3JzL2xpc3QucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3NoYXJlZC9zbWFsbHNvcnQucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC9zdGFibGUvcXVpY2tzb3J0LnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9tdXRleC9ub190aHJlYWRzLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9yd2xvY2svbm9fdGhyZWFkcy5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L3N0ZC9zcmMvc3lzL3N5bmMvb25jZS9ub190aHJlYWRzLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9pby93cml0ZS5ycwAvcnVzdGMvMGVmMWJjMzg2MDU5NTk2ZGFkYThmYjY1YjUwNDI1YWFiMmVhNjM3YS9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvY29yZS9zcmMvYnN0ci9tb2QucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9zdHIvbW9kLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMvbW9kLnJzAC9ydXN0Yy8wZWYxYmMzODYwNTk1OTZkYWRhOGZiNjViNTA0MjVhYWIyZWE2MzdhL2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvaWQucnMAL3J1c3RjLzBlZjFiYzM4NjA1OTU5NmRhZGE4ZmI2NWI1MDQyNWFhYjJlYTYzN2EvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS9yZXByX2lvdmVjLnJzAHBhY2thZ2VzL3dhc20vc2NlbmUzZC9zcmMvbGliLnJzAC8AEXN0YXJ0IGJ5dGUgaW5kZXggwCYgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlIMAIIChieXRlcyDACyBvZiBzdHJpbmcpAA9lbmQgYnl0ZSBpbmRleCDAJiBpcyBub3QgYSBjaGFyIGJvdW5kYXJ5OyBpdCBpcyBpbnNpZGUgwAggKGJ5dGVzIMALIG9mIHN0cmluZykAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMBHIGJ5dGVzIGZhaWxlZApza2lwcGluZyBiYWNrdHJhY2UgcHJpbnRpbmcgdG8gYXZvaWQgcG90ZW50aWFsIHJlY3Vyc2lvbgoANWZhdGFsIHJ1bnRpbWUgZXJyb3I6IGZhaWxlZCB0byBpbml0aWF0ZSBwYW5pYywgZXJyb3IgwAssIGFib3J0aW5nCgAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwA4gYnl0ZXMgZmFpbGVkCgAMcGFuaWNrZWQgYXQgwAI6CsAzCnRocmVhZCBwYW5pY2tlZCB3aGlsZSBwcm9jZXNzaW5nIHBhbmljLiBhYm9ydGluZy4KAAkKdGhyZWFkICfAAycgKMAOKSBwYW5pY2tlZCBhdCDAAjoKwAEKABlhYm9ydGluZyBkdWUgdG8gcGFuaWMgYXQgwAI6CsABCgAjOWJiMGZmI2FhYmZmZiNjOWQ2ZmYjZjhmOWZmI2ZmZjJkZiNmZmQ5YTAjZmZiNDZjI2ZmOWE1NXBsYW5ldCM3ZmI4ZGQjYThjNmUwI2Q5YzQ5YSNjOThhNWEjYjA2YTRmIzhkOWRiNiNlMGQzYjgjYzE1NzNiAAAAAAAAbWlkID4gbGVuYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3RmaWxlIG5hbWUgY29udGFpbmVkIGFuIHVuZXhwZWN0ZWQgTlVMIGJ5dGVtYWluPHVubmFtZWQ+bm90ZTogcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPTFgIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGRpc3BsYXkgYSBiYWNrdHJhY2UKZmF0YWwgcnVudGltZSBlcnJvcjogRmFpbGVkIHRvIGdyb3cgVExTIGRlc3RydWN0b3IgbGlzdCwgYWJvcnRpbmcKAABc9ulf3AL2ufHBcGzyYcEkDbyepieGPENuzl2YNQHmpGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGU6IGludmFsaWQgT25jZSBzdGF0ZWZhdGFsIHJ1bnRpbWUgZXJyb3I6IGFzc2VydGlvbiBmYWlsZWQ6IGtleSBhcyB1c2l6ZSAhPSBLRVlfU0VOVFZBTCwgYWJvcnRpbmcKZmF0YWwgcnVudGltZSBlcnJvcjogcndsb2NrIGxvY2tlZCBmb3Igd3JpdGluZywgYWJvcnRpbmcKcndsb2NrIG92ZXJmbG93ZWQgcmVhZCBsb2Nrc1JVU1RfQkFDS1RSQUNFY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXhhZHZhbmNpbmcgSW9TbGljZSBiZXlvbmQgaXRzIGxlbmd0aGFkdmFuY2luZyBpbyBzbGljZXMgYmV5b25kIHRoZWlyIGxlbmd0aEJveDxkeW4gQW55PnRocmVhZCBjYXVzZWQgbm9uLXVud2luZGluZyBwYW5pYy4gYWJvcnRpbmcuCmZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXJzdGFjayBiYWNrdHJhY2U6Cm5vdGU6IFNvbWUgZGV0YWlscyBhcmUgb21pdHRlZCwgcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPWZ1bGxgIGZvciBhIHZlcmJvc2UgYmFja3RyYWNlLgpmYXRhbCBydW50aW1lIGVycm9yOiB0aGUgU3lzdGVtIGFsbG9jYXRvciBtYXkgbm90IHVzZSBUTFMgd2l0aCBkZXN0cnVjdG9ycywgYWJvcnRpbmcKZmF0YWwgcnVudGltZSBlcnJvcjogVW5leHBlY3RlZCBUTFMgZmFpbHVyZSwgYWJvcnRpbmcKZmF0YWwgcnVudGltZSBlcnJvcjogb3V0IG9mIFRMUyBrZXlzLCBhYm9ydGluZwpzdHJlcnJvcl9yIGZhaWx1cmVmYWlsZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIHRocmVhZCBJRDogYml0c3BhY2UgZXhoYXVzdGVkcndsb2NrIGhhcyBub3QgYmVlbiBsb2NrZWQgZm9yIHJlYWRpbmciAQgJKw0rKyscKysGAgMeKysaDCsbBCsrJyMUKSsPEiggKyshCisFKCsrACsrKyYrKxgkBw4QKyskKysrKwELKysrKxEZKxMWHR9IYXNoIHRhYmxlIGNhcGFjaXR5IG92ZXJmbG93AQAAAAAAAAAAAAAAAwAAAAQAAAAEAAAABgAAAIP5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AAAAQOc/AAAAAAAAAAAAyHHCjXHUP3XWZwnOJy+9AAAAAAAg5z8AAAAAAAAAAAAwF57gydQ/pNgKG4kgLr0AAAAAAADnPwAAAAAAAAAAAKA4B64i1T9Zx2SBcL4uPQAAAAAA4OY/AAAAAAAAAAAA0MhT93vVP+9AXe7trR89AAAAAADA5j8AAAAAAAAAAABgWd+91dU/3GWkCCoLCr1TdWNjZXNzAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAE5vIHN1Y2ggZGV2aWNlAE5vdCBhIGRpcmVjdG9yeQBJcyBhIGRpcmVjdG9yeQBUZXh0IGZpbGUgYnVzeQBFeGVjIGZvcm1hdCBlcnJvcgBJbnZhbGlkIGFyZ3VtZW50AEFyZ3VtZW50IGxpc3QgdG9vIGxvbmcAU3ltYm9saWMgbGluayBsb29wAEZpbGVuYW1lIHRvbyBsb25nAFRvbyBtYW55IG9wZW4gZmlsZXMgaW4gc3lzdGVtAE5vIGZpbGUgZGVzY3JpcHRvcnMgYXZhaWxhYmxlAEJhZCBmaWxlIGRlc2NyaXB0b3IATm8gY2hpbGQgcHJvY2VzcwBCYWQgYWRkcmVzcwBGaWxlIHRvbyBsYXJnZQBUb28gbWFueSBsaW5rcwBObyBsb2NrcyBhdmFpbGFibGUAUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIAU3RhdGUgbm90IHJlY292ZXJhYmxlAFByZXZpb3VzIG93bmVyIGRpZWQAT3BlcmF0aW9uIGNhbmNlbGVkAEZ1bmN0aW9uIG5vdCBpbXBsZW1lbnRlZABObyBtZXNzYWdlIG9mIGRlc2lyZWQgdHlwZQBJZGVudGlmaWVyIHJlbW92ZWQATGluayBoYXMgYmVlbiBzZXZlcmVkAFByb3RvY29sIGVycm9yAEJhZCBtZXNzYWdlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUXVvdGEgZXhjZWVkZWQATXVsdGlob3AgYXR0ZW1wdGVkAENhcGFiaWxpdGllcyBpbnN1ZmZpY2llbnQAAAAAAAAAAAAAAHUCTgDWAeIEuQQYAY4F7QIWBPIAlwMBAzgFrwGCAU8DLwQeANQFogASAx4DwgHeAwgArAUAAWQC8QFlBTQCjALPAi0DTATjBZ8C+AQcBQgF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BQAAAAAAAHAABwAtAQEBAgECAQNGCzAVEAFlBwIGAgIBBCMBHhtbCzoJCQEYBAEJAQMBBSsDOwkqGAEgNwEBAQQIBAEDBwoCHQE6AQEBAgQIAQkBCgIaAQICOQEEAgQCAgMDAR4CAwELAjkBBAUBAgQBFAIWBgEBOgEBAgEECAEFBQoCHgE7AQEBDAEJASgBAwE3AQEDBQMBBAcCCwIdAToBAgIBAQMDAQQHAgsCHAI5AgEBAgQIAQkBCgIdAUgBBAECAwEBCAFRAQIHDAhiAQIJCwdJAhsBAQEBATcOAQUBAgULASQJAWYEAQYBAgICGQIEAxAEDQECAgYBDwEAAwAEHAMdAh4CQAIBBwgBAgsJAS0DAQF1AiIBdgMEAgkBBgPbAgIBOgEBBwEBAQECCAYKAgEwQQ8EMAoEAyYJDAIgBAIGOAEBAgMBAQU4CAICmAMBDQEHBAEGAQMCxkAAAcMhAAONAWAgAAZpAgAEAQogAlACAAEDAQQBGQIFAZcCGhINASYIGQsBASwDMAECBAICAgEkAUMGAgICAgwBCAEvATMBAQMCAgUCAQEqAggB7gECAQQBAAEAEBAQAAIAAeIBlQUAAwECBQQoAwQBpQIABEEFAAIeBSAQRgsxBHsBNg8pAQICCgMxBAICBwE9AyQFAQg+AQwCNAkBAQgEAgFfAwIEBgECAZ0BAwgVAjkCAQEBAQwBCQEOBwMFQwECBgEBAgEBAwQDAQEOAlUIAgMBARcBUQECBgEBAgEBAgEC6wECBAYCAQIbAlUIAgEBAmoBAQECCGUBAQECBAEFAAkBAvUBCgQEAZAEAgIEASAKKAYCBAgBCQYCAy4NAQLGAQEDAQHJBwEGAQFSFgIHAQIBAnoGAwEBAgEHAQFIAgMBAQFYAQACCwI0BQUDFwEAAQYPAAwDAwAFOwcAAT8EUQELAgACAC4CFwACPAUDBggIAgceBJQDCwMIAgIBIAIANwQyCAEOARYFAQ8ABwERAgcBAgEFZAGgBwABPQQABP4C8wECAQcCBQEAB20HAGCA8ACtAQABAAEAAgACVQUABRoFMRAAAQAQ7wGgAU8JAAQACAAAAK0BAAYWAcABMQEAAlABAAEABRoFMQUBCgAB+QMAAQ8BABAABAAIAAEeYAAwMTIzNDU2Nzg5YWJjZGVmY2FsbGVkIGBPcHRpb246OnVud3Jh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");
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
			postReturn0 = exports1["cabi_post_build-fleet-scene"];
			try {
				WebAssembly.promising(exports1["cabi_post_build-fleet-scene"]);
			} catch {
				exports1["cabi_post_build-fleet-scene"];
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
		exports1BuildFleetScene = exports1["build-fleet-scene"];
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
export { buildFleetScene };
export const _util = {
	stop: _stopInstance.bind(void 0, _jcoComponentStopContext),
	whenIdle: _whenIdle.bind(void 0, _jcoComponentIdleContext)
};
