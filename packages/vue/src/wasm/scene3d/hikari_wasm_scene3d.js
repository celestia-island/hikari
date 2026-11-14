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
	task.setReturnResultTypeIdx(21);
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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABswEbYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gBn9/f39/fwBgBH9/f38Bf2AHf39/f39/fwBgA39/fABgAnx8AXxgBX9/f39/AX9gAnx/AX9gA3x8fwF8YAF8AXxgAn98AXxgAX8BfGADfH5+AXxgAnx/AXxgCH9/f39/f39/AAKdCBYgd2FzaTpyYW5kb20vaW5zZWN1cmUtc2VlZEAwLjIuMTINaW5zZWN1cmUtc2VlZAAGE3dhc2k6aW8vZXJyb3JAMC4yLjAUW3Jlc291cmNlLWRyb3BdZXJyb3IABhJ3YXNpOmlvL3BvbGxAMC4yLjAXW3Jlc291cmNlLWRyb3BdcG9sbGFibGUABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAYVd2FzaTppby9zdHJlYW1zQDAuMi4wHFtyZXNvdXJjZS1kcm9wXW91dHB1dC1zdHJlYW0ABh13YXNpOmNsaS90ZXJtaW5hbC1pbnB1dEAwLjIuMB1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAGHndhc2k6Y2xpL3Rlcm1pbmFsLW91dHB1dEAwLjIuMB5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQABhp3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMA9nZXQtZW52aXJvbm1lbnQABhN3YXNpOmNsaS9leGl0QDAuMi4wBGV4aXQABhJ3YXNpOmlvL3BvbGxAMC4yLjAWW21ldGhvZF1wb2xsYWJsZS5ibG9jawAGEndhc2k6aW8vcG9sbEAwLjIuMARwb2xsAAcVd2FzaTppby9zdHJlYW1zQDAuMi4wIVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQABFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUAAhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAkW21ldGhvZF1vdXRwdXQtc3RyZWFtLmJsb2NraW5nLWZsdXNoAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wH1tt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AkACQAJAAkACQAJAIAFBosSIEUsNAAJAAkAgAw0AQQQhBUEAIQMMAQsQuYCAgABBBCEEIANBBBC1gICAACIFRQ0BIAEhAwsgAkEANgIsIAIgBTYCKCACIAM2AiQCQCABRQ0AQQAhBkEAIQdBACEEA0AgACAGaiIDQShqIQggA0Ecai0AACEJQX8hCkF/IQsCQCADQRBqLQAAQQFxRQ0AIANBGGooAgAiC61CIIYgA0EUajUCAIQhDAsgA0EsaiENIAgtAAAhCAJAIAlBAXFFDQAgA0EkaigCACIKrUIghiADQSBqNQIAhCEOCyANLQAAIQ9BAiEJAkAgCEEBcUUNACADQSlqLQAAQQBHIQkLIANBDGohCCADQQhqIRAgA0EEaiERQX8hDQJAIA9BAXFFDQAgA0E0aigCACINrUIghiADQTBqNQIAhCESCyADKAIAIQ8gCCgCACETIBAoAgAhECARKAIAIQgCQCAEIAIoAiRHDQAgAkEkahCugICAACACKAIoIQULIAUgB2oiAyAINgIAIANBOGogCToAACADQTRqIBM2AgAgA0EwaiAQNgIAIANBKGogEjcCACADQSRqIA02AgAgA0EcaiAONwIAIANBGGogCjYCACADQRBqIAw3AgAgA0EMaiALNgIAIANBCGogCDYCACADQQRqIA82AgAgAiAEQQFqIgQ2AiwgBkE4aiEGIAdBPGohByABIARHDQALIAAgAUE4bEEEELaAgIAACyACQQhqIAJBJGoQsICAgAAgAi0AICEUIAIoAhwhFSACKAIUIRYgAigCGCEXIAIoAgghGCACKAIMIRkgAkEwakEEIAIoAhAiGkHkAGwQuoCAgAAgGSAaQfgAbGohGyACKAIwIRwgGSEDAkACQCAaRQ0AIBwhBCAZIQMCQANAIAMoAgAiC0F/Rg0BIANB8ABqKAIAIR0gA0HsAGooAgAhHiADQegAaioCACEfIANB5ABqKgIAISAgA0HgAGoqAgAhISADQdwAaioCACEiIANB2ABqKgIAISMgA0HUAGoqAgAhJCADQdAAaioCACElIANBzABqKgIAISYgA0HIAGoqAgAhJyADQcQAaioCACEoIANBwABqKgIAISkgA0E8aioCACEqIANBOGooAgAhCiADQTRqKAIAISsgA0EwaigCACEQIANBLGooAgAhCCADQShqKAIAISwgA0EkaigCACEPIANBIGooAgAhByADQRxqKAIAIQAgA0EYaigCACENIANBFGooAgAhBiADQRBqKAIAIQEgA0EMaigCACEJIANB9ABqLQAAIS0gA0EEaikCACISpyETAkACQCALIBJCIIgiEqciEUsNACATIQUMAQsCQCASQgBSDQBBASEFIBMgC0EBELaAgIAADAELIBMgC0EBIBEQt4CAgAAiBUUNBgsgBCAFNgIAIARBBGogETYCAAJAAkAgCSAGSw0AIAEhCwwBCwJAIAYNAEEBIQsgASAJQQEQtoCAgAAMAQsgASAJQQEgBhC3gICAACILRQ0HCyAEQQhqIAs2AgAgBEEMaiAGNgIAAkACQCANIAdLDQAgACEGDAELAkAgBw0AQQEhBiAAIA1BARC2gICAAAwBCyAAIA1BASAHELeAgIAAIgZFDQgLIARBGGogLToAACAEQRBqIAY2AgAgBEEUaiAHNgIAAkACQCAPIAhLDQAgLCEGDAELAkAgCA0AQQEhBiAsIA9BARC2gICAAAwBCyAsIA9BASAIELeAgIAAIgZFDQkLIARBHGogBjYCACAEQSBqIAg2AgACQAJAIBAgCksNACArIQYMAQsCQCAKDQBBASEGICsgEEEBELaAgIAADAELICsgEEEBIAoQt4CAgAAiBkUNCgsgBEHgAGogHTYCACAEQdwAaiAeNgIAIARB2ABqIB84AgAgBEHUAGogIDgCACAEQdAAaiAhOAIAIARBzABqICI4AgAgBEHIAGogIzgCACAEQcQAaiAkOAIAIARBwABqICU4AgAgBEE8aiAmOAIAIARBOGogJzgCACAEQTRqICg4AgAgBEEwaiApOAIAIARBLGogKjgCACAEQSRqIAY2AgAgBEEoaiAKNgIAIARB5ABqIQQgA0H4AGoiAyAbRw0ADAMLCyADQfgAaiEDCyAbIANrQfgAbiEEIBsgA0YNAANAIAMQnYCAgAAgA0H4AGohAyAEQX9qIgQNAAsLAkAgGEUNACAZIBhB+ABsQQQQtoCAgAALI4GAgIAAQZCVwYAAaiIDIBw2AgAgAyAaNgIEIAJBMGpBBCAVQeQAbBC6gICAACAXIBVB+ABsaiEbIAIoAjAhGSAXIQMCQAJAIBVFDQAgGSEEIBchAwJAA0AgAygCACILQX9GDQEgA0HwAGooAgAhHSADQewAaigCACEeIANB6ABqKgIAIR8gA0HkAGoqAgAhICADQeAAaioCACEhIANB3ABqKgIAISIgA0HYAGoqAgAhIyADQdQAaioCACEkIANB0ABqKgIAISUgA0HMAGoqAgAhJiADQcgAaioCACEnIANBxABqKgIAISggA0HAAGoqAgAhKSADQTxqKgIAISogA0E4aigCACEKIANBNGooAgAhKyADQTBqKAIAIRAgA0EsaigCACEIIANBKGooAgAhLSADQSRqKAIAIQ8gA0EgaigCACEHIANBHGooAgAhACADQRhqKAIAIQ0gA0EUaigCACEGIANBEGooAgAhASADQQxqKAIAIQkgA0H0AGotAAAhLCADQQRqKQIAIhKnIRMCQAJAIAsgEkIgiCISpyIRSw0AIBMhBQwBCwJAIBJCAFINAEEBIQUgEyALQQEQtoCAgAAMAQsgEyALQQEgERC3gICAACIFRQ0LCyAEIAU2AgAgBEEEaiARNgIAAkACQCAJIAZLDQAgASELDAELAkAgBg0AQQEhCyABIAlBARC2gICAAAwBCyABIAlBASAGELeAgIAAIgtFDQwLIARBCGogCzYCACAEQQxqIAY2AgACQAJAIA0gB0sNACAAIQYMAQsCQCAHDQBBASEGIAAgDUEBELaAgIAADAELIAAgDUEBIAcQt4CAgAAiBkUNDQsgBEEYaiAsOgAAIARBEGogBjYCACAEQRRqIAc2AgACQAJAIA8gCEsNACAtIQYMAQsCQCAIDQBBASEGIC0gD0EBELaAgIAADAELIC0gD0EBIAgQt4CAgAAiBkUNDgsgBEEcaiAGNgIAIARBIGogCDYCAAJAAkAgECAKSw0AICshBgwBCwJAIAoNAEEBIQYgKyAQQQEQtoCAgAAMAQsgKyAQQQEgChC3gICAACIGRQ0PCyAEQeAAaiAdNgIAIARB3ABqIB42AgAgBEHYAGogHzgCACAEQdQAaiAgOAIAIARB0ABqICE4AgAgBEHMAGogIjgCACAEQcgAaiAjOAIAIARBxABqICQ4AgAgBEHAAGogJTgCACAEQTxqICY4AgAgBEE4aiAnOAIAIARBNGogKDgCACAEQTBqICk4AgAgBEEsaiAqOAIAIARBJGogBjYCACAEQShqIAo2AgAgBEHkAGohBCADQfgAaiIDIBtHDQAMAwsLIANB+ABqIQMLIBsg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Qf8BcSIBQQNHDQAgAkGoBGpBBHIQloKAgAAMAQsgAUH/AUYNAQsgACgCDEEkaigCACEBIAAoAgghACACIAc3A8gEIAIgBjcDwAQgAiAINwO4BCACIAU3A7AEIAJB0ARqIAAjgYCAgABB3pHAgABqIAJBsARqIAERgoCAgACAgICAACACLQDQBEEDRw0BIAJB1ARqEJaCgIAADAELIAIoAqAEIgFBgARLDQIgAkGwBGogACgCCCACQRhqIAEgACgCDCgCHBGCgICAAICAgIAAIAItALAEQQNHDQAgAkG0BGoQloKAgAALIAJB4ARqJICAgIAADwsQvoCAgAAAC0EAIAFBgAQjgYCAgABByI/BgABqEPiBgIAAAAsUACAAKAIAIAAoAgQgARCYgoCAAAufAQIDfwF+I4CAgIAAQSBrIgIkgICAgAAgASgCBCEDIAEoAgAhBCACIAAoAgAiASkCADcCACACI4mAgIAArUIghiIFIAFBDGqthDcDGCACIAUgAUEIaq2ENwMQIAIjgoCAgABBgoCAgABqrUIghiACrYQ3AwggBCADI4GAgIAAQeiAwIAAaiACQQhqEPaBgIAAIQEgAkEgaiSAgICAACABC4cDAgN/AX4jgICAgABBIGsiAiSAgICAACOBgICAAEGIlsGAAGoiAy0AACEEIANBAToAACOKgICAAK1CIIYhBQJAAkAgBA0AIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEHwkMCAAGogAkEQahDWgICAACACQQRqEL+AgIAAENKAgIAAIQECQAJAAkACQBDkgICAAEH/AXEOAwABAgMLIAJBEGogAkEfaiOCgICAAEGHgICAAGpBABDTgICAACACQRBqEL+AgIAADAILIAJBEGogAkEfaiOCgICAAEGHgICAAGpBARDTgICAACACQRBqEL+AgIAADAELIAJBEGogAkEfaiOBgICAAEHWlMCAAGpBnQEQ1oCAgAAgAkEQahC/gICAAAsgAUEAOgAADAELIAIgATYCDCACIAUgAkEMaq2ENwMQIAJBBGogAkEfaiOBgICAAEHMj8CAAGogAkEQahDWgICAACACQQRqEL+AgIAACyACQSBqJICAgIAACwkAEOWAgIAAAAu8AgMCfwF+AX8jgICAgABBIGsiAySAgICAABDSgICAACEEIAApAgAhBSADIAI2AhggAyABNgIUIAMgBTcCDAJAAkAji4CAgAAoAgAiBkECSw0AIANBDGpBABDMgICAAAwBCyADIAZBeGo2AhwgA0EMaiADQRxqEMyAgIAACwJAAkACQAJAIAAoAggtAAAOAwABAgMLIANBDGogASACKAIkQQAQ04CAgAAgA0EMahC/gICAAAwCCyADQQxqIAEgAigCJEEBENOAgIAAIANBDGoQv4CAgAAMAQsjgYCAgABBhJHBgABqIgAtAAAhBiAAQQA6AAAgBkUNACADQQxqIAEjgYCAgABB1pTAgABqQZ0BIAIoAiQRgoCAgACAgICAACADQQxqEL+AgIAACyAEQQA6AAAgA0EgaiSAgICAAAuOAQEDfyOAgICAAEEQayIAJICAgIAAI4GAgIAAQYmWwYAAaiIBLQAAIQIgAUEBOgAAIAAgAjoADwJAIAJBAUcNACOBgICAACECQQAgAEEPaiOMgICAACACQaeWwIAAakHBACACQcSQwYAAahC9gICAAAALI4GAgIAAIQIgAEEQaiSAgICAACACQYmWwYAAagtgAQF/I4CAgIAAQRBrIgQkgICAgAAgBCADOgAHIAQjjYCAgACtQiCGIARBB2qthDcDCCAAIAEjgYCAgABBzoTAgABqIARBCGogAhGCgICAAICAgIAAIARBEGokgICAgAALmAMBA38jgICAgABBMGsiASSAgICAAEH/ASECAkAgAC0ADQ0AQQEhAiOBgICAAEGslcGAAGooAgBBAUsNABDkgICAACECCyABIAI6AAsgASAAKAIINgIMIAEgACgCACAAKAIEEOaAgIAAIAEgASkDADcCECOBgICAAEHklcGAAGotAAAhACABIAFBC2o2AiAgASABQRBqNgIcIAEgAUEMajYCGAJAAkACQCAARQ0AI4GAgIAAIgBB5JXBgABqQQE6AAAgAEGolcGAAGoiAigCACEAIAJBADYCACAADQELIAFBGGogAUEvaiOBgICAAEGIkcGAAGoQ0YCAgAAMAQsjgYCAgAAhAiABQRhqIABBCGoQ4YCAgAAiA0EEaiACQbCRwYAAahDRgICAACADQQA6AAAgAkHklcGAAGpBAToAACACQaiVwYAAaiIDKAIAIQIgAyAANgIAIAEgAjYCKCABQQE2AiQgAkUNACACIAIoAgAiAEF/ajYCACAAQQFHDQAgAUEkakEEahDigICAAAsgAUEwaiSAgICAAAtuAQF/I4CAgIAAQSBrIgIkgICAgAAgAiAAIAEQvICAgAA2AgQgAiOJgICAAK1CIIYgAkEEaq2ENwMQIAJBCGogAkEfaiOBgICAAEGskMCAAGogAkEQahDWgICAACACQQhqEL+AgIAAENCAgIAAAAu5AQEBfyOAgICAAEEQayIEJICAgIAAIABB/wE6AAAgBCABNgIIIAQgACkCADcDACAEI4GAgIAAQZiPwYAAaiACIAMQ9oGAgAAhASAELQAAIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQcmTwIAAakGtASAEQfCOwYAAahD3gYCAAAALIANB/wFxQQNHDQEgBEEEchCWgoCAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAALcQEBfyOAgICAAEEQayICJICAgIAAAkACQAJAIAFBCEsNACABIABNDQELIAJBADYCDCACQQxqIAFBBCABQQRLGyAAEOWBgIAAIQFBACACKAIMIAEbIQEMAQsgABDdgYCAACEBCyACQRBqJICAgIAAIAELCQAQ0ICAgAAACwoAIAAQ4IGAgAALnQEBAn8jgICAgABBEGsiBCSAgICAAAJAAkACQCACQQhLDQAgAiADTQ0BC0EAIQUgBEEANgIMIARBDGogAkEEIAJBBEsbIAMQ5YGAgAANASAEKAIMIgJFDQECQCADIAEgAyABSRsiA0UNACACIAAgA/wKAAALIAAQ4IGAgAAgAiEFDAELIAAgAxDjgYCAACEFCyAEQRBqJICAgIAAIAULOAIBfwF+I4CAgIAAQRBrIgEkgICAgAAgACkCACECIAEgADYCDCABIAI3AgQgAUEEahDGgICAAAALigEBAn8jgICAgABBEGsiAiSAgICAAAJAAkACQCABQQhLDQAgASAATQ0BC0EAIQMgAkEANgIMIAJBDGogAUEEIAFBBEsbIAAQ5YGAgAANASACKAIMIgFFDQECQCAARQ0AIAFBACAA/AsACyABIQMMAQsgAEEBEOKBgIAAIQMLIAJBEGokgICAgAAgAwsNACABIAAQ3oCAgAAACy8BAX8jgICAgABBEGsiAiSAgICAACACIAE2AgwgAiAANgIIIAJBCGoQxICAgAAAC+8BAgN/AX4jgICAgABBEGsiAiSAgICAACABKAIEIQMgASgCACEEIAAtAAAhACACQQRqEOOAgIAAIAIpAgghBQJAIAIoAgQiAUF/Rw0AIAVC/wGDQgNSDQAgAkEMahCWgoCAAAsCQAJAAkACQCAEI4GAgIAAQcuXwIAAakERIAMoAgwiAxGDgICAAICAgIAADQAgAEEBcQ0BIAQjgYCAgABB3JfAgABqQdgAIAMRg4CAgACAgICAAEUNAQtBASEEIAFBAEoNAQwCC0EAIQQgAUEATA0BCyAFpyABQQEQtoCAgAALIAJBEGokgICAgAAgBAvxAgECfyOAgICAAEGgA2siAySAgICAAAJAAkACQAJAIAJB/wJLDQACQCACRQ0AIANBFGogASAC/AoAAAsgA0EUaiACakEAOgAAIANBlANqIANBFGogAkEBahCBgoCAAAJAIAMoApQDQQFHDQBBfiECIANBfjYCCCADI4GAgIAAQcCPwYAAaikDADcCDAwCCwJAIAMoApgDEMKBgIAAIgFFDQACQAJAIAEQ2oGAgAAiAg0AQQEhBAwBCxC5gICAACACQQEQtYCAgAAiBEUNBCACRQ0AIAQgASAC/AoAAAsgAyACNgIQIAMgBDYCDCADIAI2AggMAgtBfyECIANBfzYCCAwBCyADQQhqIAEgAhDKgICAACADKAIIIQILAkAgAkF+Rg0AIAAgAykCDDcCBCAAIAI2AgAMAgsCQCADLQAMQQNHDQAgA0EQahCWgoCAAAsgAEF/NgIADAELQQEgAhDpgYCAAAALIANBoANqJICAgIAAC3IBAn8jgICAgABBEGsiASSAgICAACAALQAAIQIgAEEBOgAAIAEgAjoADwJAIAJBAUcNACOBgICAACEAQQAgAUEPaiOMgICAACAAQaeWwIAAakHBACAAQcSQwYAAahC9gICAAAALIAFBEGokgICAgAAgAAtXAQF/AkAgACgCACIAQQxqKAIAIgFFDQAgAEEQaigCACABQQEQtoCAgAALAkAgAEF/Rg0AIAAgACgCBCIBQX9qNgIEIAFBAUcNACAAQRhBBBC2gICAAAsLiwMBBn8jgICAgABBEGsiASSAgICAABC5gICAAEGABCECAkACQAJAAkBBgARBARC1gICAACIDRQ0AIAEgAzYCCCABQYAENgIEAkACQCADQYAEEJyBgIAADQBBgAQhAgNAI4GAgIAAIQQjjoCAgAAoAgAhBSOPgICAACgCACEGAkAgBSAEQaiQwYAAakYNACOBgICAAEGokMGAAGoQlIKAgAALIAZBxABHDQIgASACNgIMIAFBBGogAkEBQQFBARDJgICAACABKAIIIgMgASgCBCICEJyBgIAARQ0ACwsgASADENqBgIAAIgY2AgwgAiAGTQ0DAkAgBg0AQQEhBCADIAJBARC2gICAAAwDCyADIAJBASAGELeAgIAAIgQNAkEBIAYQ6YGAgAAACyAAQX82AgAgACAGrUIghjcCBCACRQ0DIAMgAkEBELaAgIAADAMLQQFBgAQQ6YGAgAAACyABIAY2AgQgASAENgIICyAAIAEoAgw2AgggACABKQIENwIACyABQRBqJICAgIAAC6QCAQV/I4CAgIAAQRBrIgAkgICAgABBAyEBAkAjgYCAgABB1JXBgABqLQAAQX9qIgJB/wFxQQNJDQAgAEEEaiOBgICAAEGZlsCAAGpBDhDggICAAAJAAkAgACgCBCIDQX9HDQBBAiECDAELAkACQAJAAkAgACgCDEF/ag4EAAICAQILIAAoAggiBC0AAEEwRw0BQQMhAUECIQIgAw0CDAMLIAAoAggiBCgAAEHm6rHjBkcNAEECIQFBASECIAMNAQwCC0EBIQFBACECIANFDQEgACgCCCEECyAEIANBARC2gICAAAsjgYCAgABB1JXBgABqIgMgAy0AACIDIAEgAxs6AAAgA0UNACADQX9qQX8gA0EESRshAgsgAEEQaiSAgICAACACCwkAEJuBgIAAAAvyAQIDfwJ+I4CAgIAAQRBrIgMkgICAgAAgAyABIAIoAgwiBBGBgICAAICAgIAAQQQhAiABIQUCQAJAIAMpAwBC3Oyn/8XbgPu5f4UgAykDCELxg8Pjpr7Y4CSFhFANACADIAEgBBGBgICAAICAgIAAIAMpAwghBiADKQMAIQcjgYCAgAAhAgJAIAdCj86Yi6+0hYKKf4UgBkLMzs7v787A7/EAhYRCAFENACACQZKXwIAAaiEBQQwhAgwCCyABQQRqIQVBCCECCyABIAJqKAIAIQIgBSgCACEBCyAAIAI2AgQgACABNgIAIANBEGokgICAgAAL2gIBBX8jgICAgABBEGsiBCSAgICAAAJAAkAgA0UNACAEQQxqIQUDQAJAAkACQAJAAkBBAiACIAMQl4GAgAAiBkF/Rw0AI4GAgIAAIQcjjoCAgAAoAgAhCCOPgICAACgCACEGAkAgCCAHQaiQwYAAakYNACOBgICAAEGokMGAAGoQlIKAgAALIARBADoACyAEQQA7AAkgBCAGNgIMIARBADoACCAGEJGCgIAAKAIIEYCAgIAAgICAgAANAyAEQQhqIQYMAQsgBEH/AToACCAEIAY2AgwjgYCAgAAhByAGDQEgB0HokcGAAGohBgsgACAGKQIANwIADAULAkAgAyAGSQ0AIAIgBmohAiADIAZrIQMMAgsgBiADIAMjgYCAgABBwJLBgABqEPiBgIAAAAsgBC0ACEEDRw0AIAUQloKAgAALIAMNAAsLIABB/wE6AAALIARBEGokgICAgAALbQECfyOQgICAACIBIAEoAgAiAkEBajYCAEEAIQECQCACQQBIDQBBASEBI4GAgIAAQbCVwYAAai0AAA0AI4GAgIAAIgFBsJXBgABqIAA6AAAgAUGslcGAAGoiASABKAIAQQFqNgIAQQIhAQsgAQscACAAKAIAIAEgACgCBCgCDBGEgICAAICAgIAACwoAIAAQk4GAgAALBwAgAEEbRgsvAQF/QSshAQJAIABBf2oiAEHKAEsNACOBgICAAEG/mcCAAGogAGotAAAhAQsgAQslAQF/IAAjgYCAgABBtJXAgABqIgIpAgg3AgggACACKQIANwIACyUBAX8gACOBgICAAEGklcCAAGoiAikCCDcCCCAAIAIpAgA3AgALwQEEA38BfgJ/AX5BACEDAkBBACAAKAIIIgQoAgQiBSAEKQMIIgZC/////w8gBkL/////D1Qbp2siByAHIAVLGyIHIAIgByACSRsiCEUNACAEKAIAIAYgBa0iCSAGIAlUG6dqIAEgCPwKAAALIAQgBiAIrXw3AwgCQCAHIAJPDQAjgYCAgABB6JHBgABqKQMAIgZC/wGDQv8BUQ0AAkAgAC0AAEEDRw0AIABBBGoQloKAgAALIAAgBjcCAEEBIQMLIAMLYwEBfwJAAkACQCACIAAoAggiACgCACAAKAIIIgNrTQ0AIAAgAyACQQFBARDJgICAACAAKAIIIQMMAQsgAkUNAQsgAkUNACAAKAIEIANqIAEgAvwKAAALIAAgAyACajYCCEEAC2kBAX8jgICAgABBEGsiAySAgICAACADQQhqIAMg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gABBf0wNACACQZQIaiACQRRqIAJBFGoQ2oGAgAAQ64GAgAAgAkEIaiACQZQIahDwgYCAACABIAIoAgwiAyACKAIQEIaCgIAAIQACQCACKAIIIgFFDQAgAyABQQEQtoCAgAALIAJBoAhqJICAgIAAIAAPCyOBgICAACICQdCYwIAAakElIAJB8JHBgABqEPeBgIAAAAsbACAAI4GAgIAAQdiPwYAAaiABIAIQ9oGAgAALRgACQAJAAkAgAQ0AIANFDQIQuYCAgAAgAyACELWAgIAAIgJFDQEMAgsgACABIAIgAxC3gICAACICDQELEOWAgIAAAAsgAgsCAAs8AQF/I4CAgIAAQRBrIgEkgICAgAAgARCAgICAACAAIAEpAwg3AwggACABKQMANwMAIAFBEGokgICAgAALMgACQCABRQ0AI4GAgIAAIgFBiprAgABqQTkgAUHMk8GAAGoQ94GAgAAACyAAQQA2AgALIwACQCABRQ0AIAIgAxDsgYCAAAALIAAgAzYCBCAAIAI2AgALYwEBfwJAIAJBAEgNAAJAIAJFDQADQAJAIAFBBGooAgAiA0UNACAAIAEoAgAgAxCXgYCAAA8LIAFBCGohASACQX9qIgINAAsLIABBAEEAEJeBgIAADwsjj4CAgABBHDYCAEF/C7gBAQR/I4CAgIAAQSBrIgMkgICAgABBfyEEAkAgABCegYCAACIARQ0AAkAgACgCBCIFKAIIIgZFDQACQCAAKAIAIANBCGogBhGEgICAAICAgIAAQQBODQBBfyEEDAILIANBCGogASACEJ+BgIAAIQQMAQsCQCAFKAJIIgZFDQAgACgCACABIAJBAEEAQQAgBhGFgICAAICAgIAAIQQMAQsjj4CAgABBOjYCAAsgA0EgaiSAgICAACAECysBAX8jgICAgABBEGsiASSAgICAACABIABBAEc6AA8gAUEPahCsgYCAAAALIAACQCOBgICAAEHck8GAAGooAgBBf0cNABCagYCAAAsL/QIBDH8jgICAgABBEGsiACSAgICAACOBgICAACEBIABBCGoQq4GAgAACQAJAAkAgACgCDCICDQAgAUGQlsGAAGohAwwBCyACQQFqIgFFDQEgAUEEEOKBgIAAIgNFDQEgACgCCCEBIAMhBEEAIQUDQCABQQhqKAIAIQYgASgCACEHIAQgAUEMaigC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gICAACABQQhqEIeAgIAAIAAgASkCCDcCACABQRBqJICAgIAACw4AIAAtAAAQiICAgAAACwoAIAAQiYCAgAALPwEBfyOAgICAAEEQayICJICAgIAAIAAoAgAgACgCBCACQQhqEIqAgIAAIAEgAikCCDcCACACQRBqJICAgIAAC3cCAX8BfiOAgICAAEEQayIDJICAgIAAIAAgAxCLgICAAAJAAkACQAJAIAMtAAAOAgACAQsgAykDCCEECyABIAQ3AwBBASEADAELIAIgAzUCDEIghkIAIAMxAAgiBFAbIASENwIAQQAhAAsgA0EQaiSAgICAACAAC1wBAX8jgICAgABBEGsiAySAgICAACAAIAEoAgAgASgCBCADQQRqEIyAgIAAAkAgAy0ABEEBRyIBDQAgAiADLQAIOgAAIAIgAygCDDYCBAsgA0EQaiSAgICAACABC1IBAX8jgICAgABBEGsiAiSAgICAACAAIAJBBGoQjYCAgAACQCACLQAEQQFHIgANACABIAItAAg6AAAgASACKAIMNgIECyACQRBqJICAgIAAIAALCgAgABCOgICAAAsIABCPgICAAAsIABCQgICAAAsIABCRgICAAAtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCSgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCTgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgtBAQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCUgICAACAAIAEoAgw2AgAgAS0ACCEAIAFBEGokgICAgAAgAEEBRgsKACAAEJWAgIAACwgAEOeBgIAAC7ICAQN/I4CAgIAAQSBrIgAkgICAgAACQAJAAkBBAUEUEOKBgIAAIgENACOPgICAAEEwNgIADAELIAAgATYCGCAAI4GAgIAAQeSTwYAAajYCHCAAIAApAhg3AxBBfyEBIABBEGoQnYGAgABBAEgNAQJAQQFBFBDigYCAACICDQAjj4CAgABBMDYCAAwCCyACQQE2AgAgACACNgIYIAAjgYCAgABB5JPBgABqNgIcIAAgACkCGDcDCCAAQQhqEJ2BgIAAQQBIDQECQEEBQRQQ4oGAgAAiAQ0AI4+AgIAA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BURJVVVVVVXFP6KgoQvzAQICfwF8I4CAgIAAQRBrIgEkgICAgAACQAJAIAC9QiCIp0H/////B3EiAkH7w6T/A0sNAEQAAAAAAADwPyEDIAJBnsGa8gNJDQEgAEQAAAAAAAAAABDDgYCAACEDDAELAkAgAkGAgMD/B0kNACAAIAChIQMMAQsgACABEMWBgIAAIQIgASsDCCEAIAErAwAhAwJAAkACQAJAIAJBA3EOBAABAgMACyADIAAQw4GAgAAhAwwDCyADIABBARDGgYCAAJohAwwCCyADIAAQw4GAgACaIQMMAQsgAyAAQQEQxoGAgAAhAwsgAUEQaiSAgICAACADCwwAIAAgAKEiACAAowsNACABIAGaIAEgABuiCxMAIABEAAAAAAAAAHAQyYGAgAALEwAgAEQAAAAAAAAAEBDJgYCAAAvYCAYBfgJ/AX4CfwF+CXwgAb0iAkI0iKdB/w9xIgNBwndqIQQCQAJAAkAgAL0iBUI0iKciBkGBcGpBgnBJDQBBACEHIARB/35LDQELAkAgAkIBhiIIQn98Qv////////9vVA0ARAAAAAAAAPA/IQkgBUKAgICAgICA+D9RDQIgCFANAgJAAkAgBUIBhiIFQoCAgICAgIBwVg0AIAhCgYCAgICAgHBUDQELIAAgAaAPCyAFQoCAgICAgIDw/wBRDQJEAAAAAAAAAAAgASABoiAFQoCAgICAgIDw/wBUIAJCAFNzGw8LAkAgBUIBhkJ/fEL/////////b1QNACAAIACiIQkCQCAFQn9VDQAgCZogCSACEM2BgIAAQQFGGyEJCyACQn9VDQJEAAAAAAAA8D8gCaMPC0EAIQcCQCAFQn9VDQACQCACEM2BgIAAIgcNACAAEMiBgIAADwtBgIAQQQAgB0EBRhshByAGQf8PcSEGIAC9Qv///////////wCDIQULAkAgBEH/fksNAEQAAAAAAADwPyEJIAVCgICAgICAgPg/UQ0CIANBvgdJDQICQCACQgBTIAVCgICAgICAgPg/VkYNAEEAEMqBgIAADwtBABDLgYCAAA8LIAYNACAARAAAAAAAADBDor1C////////////AINCgICAgICAgOB8fCEFCwJAIAJCgICAQIO/IgogBSAFQoCAgICw1dqMQHwiAkKAgICAgICAeIN9IgVCgICAgAh8QoCAgIBwg78i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IQMCQCABQQJqIgJBA3ENACADIQAgAiEBDAELIAMgAi0AACICOgAAIAJFDQIgAEEDaiEDAkAgAUEDaiICQQNxDQAgAyEAIAIhAQwBCyADIAItAAAiAjoAACACRQ0CIABBBGohACABQQRqIQELQYCChAggASgCACICayACckGAgYKEeHFBgIGChHhHDQADQCAAIAI2AgAgAEEEaiEAQYCChAggAUEEaiIBKAIAIgJrIAJyQYCBgoR4cUGAgYKEeEYNAAsLIAAgAjoAAAJAIAJB/wFxDQAgAA8LIAFBAWohAiAAIQMDQCADQQFqIgMgAi0AACIAOgAAIAJBAWohAiAADQALCyADCw8AIAAgARDTgYCAABogAAswAQJ/AkAgABDagYCAAEEBaiIBEN2BgIAAIgJFDQAgAUUNACACIAAgAfwKAAALIAILBAAgAAsMACAAIAEQ1oGAgAALZQECfwJAI4GAgIAAQaiWwYAAaigCGCIBDQAjgYCAgABBqJbBgABqIgEgATYCGAsjgYCAgAAiAkGI4sCAAGogAkGg7sCAAGpBACAAIABBzABLG0EBdGovAQBqIAEoAhQQ14GAgAALbQEBfwJAAkAgABDYgYCAACIDENqBgIAAIgAgAkkNAEHEACEAIAJFDQECQCACQX9qIgJFDQAgASADIAL8CgAACyABIAJqQQA6AABBxAAPCwJAIABBAWoiAkUNACABIAMgAvwKAAALQQAhAAsgAAvPAQEDfyAAIQECQAJAIABBA3FFDQACQCAALQAADQAgACAAaw8LIABBAWoiAUEDcUUNACABLQAARQ0BIABBAmoiAUEDcUUNACABLQAARQ0BIABBA2oiAUEDcUUNACABLQAARQ0BIABBBGoiAUEDcQ0BCyABQXxqIQIgAUF7aiEBA0AgAUEEaiEBQYCChAggAkEEaiICKAIAIgNrIANyQYCBgoR4cUGAgYKEeEYNAAsDQCABQQFqIQEgAi0AACEDIAJBAWohAiADDQALCyABIABrC4cBAQJ/AkAgAg0AQQAPCwJAAkAgAC0AACIDDQBBACEDDAELIABBAWohACACQX9qIQICQANAIANB/wFxIAEtAAAiBEcNASAERQ0BIAJBAEYNASACQX9qIQIgAUEBaiEBIAAtAAAhAyAAQQFqIQAgAw0AC0EAIQMLIANB/wFxIQMLIAMgAS0A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KAIAQX4gBUEDdndxNgIADAULIAEoAhghBgJAIAIgAUYNACABKAIIIgQgAjYCDCACIAQ2AggMBAsCQAJAIAEoAhQiBEUNACABQRRqIQUMAQsgASgCECIERQ0DIAFBEGohBQsDQCAFIQcgBCICQRRqIQUgAigCFCIEDQAgAkEQaiEFIAIoAhAiBA0ACyAHQQA2AgAMAwsgAygCBCICQQNxQQNHDQMgAyACQX5xNgIEIAMgADYCACOBgICAAEHElsGAAGogADYCCCABIABBAXI2AgQPCyACIAQ2AgggBCACNgIMDAILQQAhAgsgBkUNAAJAAkAgASOBgICAAEHElsGAAGogASgCHCIFQQJ0aiIEKAKwAkcNACAEQbACaiACNgIAIAINASOBgICAAEHElsGAAGoiAiACKAIEQX4gBXdxNgIEDAILAkACQCAGKAIQIAFHDQAgBiACNgIQDAELIAYgAjYCFAsgAkUNAQsgAiAGNgIYAkAgASgCECIERQ0AIAIgBDYCECAEIAI2AhgLIAEoAhQiBEUNACACIAQ2AhQgBCACNgIYCyABIANPDQAgAygCBCIEQQFxRQ0AAkACQAJAAkACQCAEQQJxDQACQCADI4GAgIAAQcSWwYAAaigCGEcNACOBgICAAEHElsGAAGoiAiABNgIYIAIgAigCDCAAaiIANgIMIAEgAEEBcjYCBCABIAIoAhRHDQYjgYCAgABBxJbBgABqIgFBADYCCCABQQA2AhQPCwJAIAMjgYCAgABBxJbBgABqKAIUIgZHDQAjgYCAgABBxJbBgABqIgIgATYCFCACIAIoAgggAGoiADYCCCABIABBAXI2AgQgASAAaiAANgIADwsgBEF4cSAAaiEAIAMoAgwhAgJAIARB/wFLDQACQCACIAMoAggiBUcNACOBgICAAEHElsGAAGoiAiACKAIAQX4gBEEDdndxNgIADAULIAIgBTYCCCAFIAI2AgwMBAsgAygCGCEIAkAgAiADRg0AIAMoAggiBCACNgIMIAIgBDYCCAwDCwJAAkAgAygCFCIERQ0AIANBFGohBQwBCyADKAIQIgRFDQIgA0EQaiEFCwNAIAUhByAEIgJBFGohBSACKAIUIgQNACACQRBqIQUgAigCECIEDQALIAdBADYCAAwCCyADIARBfnE2AgQgASAAaiAANgIAIAEgAEEBcjYC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ACACIAFBASADELeAgIAAIQEMAQsCQCADDQBBASEBDAILELmAgIAAIANBARC1gICAACEBCyABDQBBASEBIABBATYCBAwBCyAAIAE2AgRBACEBC0EIIQILIAAgAmogAzYCACAAIAE2AgALnAUBBH8jgICAgABBMGsiAySAgICAACADIAI2AgggAyABNgIEIANBFGogA0EEahCVgoCAAAJAAkACQAJAIAMoAhQiBEUNACADKAIYIQEgAygCIEUNAQJAAkAgAg0AQQEhBQwBCxC5gICAACACQQEQtYCAgAAiBUUNAwtBACEGIANBADYCLCADIAU2AiggAyACNgIkAkACQAJAIAEgAk0NACADQSRqQQAgARDogYCAACADKAIkIQIgAygCKCEFIAMoAiwhBgwBCyABRQ0BCyABRQ0AIAUgBmogBCAB/AoAAAsgAyAGIAFqIgE2AiwCQCACIAFrQQJLDQAgA0EkaiABQQMQ6IGAgAAgAygCKCEFIAMoAiwhAQsgBSABaiICI4GAgIAAQbrvwIAAaiIELQACOgACIAIgBC8AADsAACADIAFBA2oiAjYCLCADIAMpAgQ3AgwgA0EUaiADQQxqEJWCgIAAAkAgAygCFCIFRQ0AA0AgAygCICEEAkACQAJAIAMoAhgiASADKAIkIAJrTQ0AIANBJGogAiABEOiBgIAAIAMoAiwhAgwBCyABRQ0BCyABRQ0AIAMoAiggAmogBSAB/AoAAAsgAyACIAFqIgI2AiwCQCAERQ0AAkAgAygCJCACa0ECSw0AIANBJGogAkEDEOiBgIAAIAMoAiwhAgsgAygCKCACaiIBI4GAgIAAQbrvwIAAaiIELwAAOwAAIAEgBC0AAjoAAiADIAJBA2oiAjYCLAsgA0EUaiADQQxqEJWCgIAAIAMoAhQiBQ0ACwsgACADKAIsNgIIIAAgAykCJDcCAAwDC0EAIQFBASEECyAAIAE2AgggACAENgIEIABBfzYCAAwBC0EBIAIQ6YGAgAAACyADQTBqJICAgIAACw0AIAEgABDdgICAAAAL5QEBBH8jgICAgABBEGsiAiSAgICAAAJAAkACQCABKAIAIgMgASgCCCIERw0AIAJBBGogBCABKAIEIARBAWoiAxDqgYCAACACKAIEQQFGDQEgASACKAIINgIECyABKAIEIgUgBGpBADoAAAJAAkAg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IANBAWoiAyAAIAIgA0ECdGooAgBB////AHFJGyIDQQJ0aigCAEELdCICIABBC3QiBEYgAiAESWogA2oiA0ECdGoiBSgCAEEVdiECQbULIQQCQAJAIANBNEsNACAFKAIEQRV2IQQgA0UNAQsgBUF8aigCAEH///8AcSEBCwJAIAQgAkF/c2pFDQAgACABayEDIARBf2ohBEEAIQADQCAAI4GAgIAAQc7xwIAAaiACai0AAGoiACADSw0BIAQgAkEBaiICRw0ACwsgAkEBcQuJAQECf0EAIQECQAJAAkACQAJAIABBCHYiAkFqag4bAAQEBAQEBAQEBAMEBAQEBAQEBAQEBAQEBAQBAgsgAEGALUYhAQwDCyAAQYDgAEYhAQwCCyACDQEjlYCAgAAgAEH/AXFqLQAAIQEMAQsjlYCAgAAgAEH/AXFqLQAAQQJxQQF2IQELIAFBAXEL7AIBBX9BACEBI4GAgIAAQbiJwYAAaiICIAJBAEEQIABBq50ESRsiAyADQQhyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQRyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJyIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkH/BSEEAkACQCADQR9LDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEGD/cCAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELrwIBBX9BACEBI4GAgIAAQbyKwYAAaiICIAJBAEEGIABBgPwDSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkEjIQQCQAJAIANBCksN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CUEBdGovAAA7AAAgBkF+aiAHIAggCUHkAGxrQf//A3FBAXRqLwAAOwAAIANBfGohAyAAQf+s4gRLDQALCwJAAkAgBUEJSw0AIAUhAAwBCyACQQZqIANBfmoiA2ojgYCAgABBloTBgABqIAUgBUH//wNxQeQAbiIAQeQAbGtB//8DcUEBdGovAAA7AAALAkACQCAERQ0AIABFDQELIAJBBmogA0F/aiIDaiOBgICAAEGWhMGAAGogAEEBdGotAAE6AAALIAFBAUEBQQAgAkEGaiADakEKIANrEIKCgIAAIQMgAkEQaiSAgICAACADCxMAIAAgASACIAMgBBCJgoCAAAAL/woCBH8BfiOAgICAAEEwayIFJICAgIAAIAUgAzYCBCAFIAI2AgAgBSABNgIIAkACQAJAAkACQAJAAkACQCACIAFLIgYNACADIAFLIgcNASACIANLDQIgAkUNBCACIAFPDQQgACACaiwAAEG/f0oNBAJAIAAgAkF/aiIIaiwAAEG/f0oNACACQX5qIgMgAkF9aiAAIANqLAAAQb9/ShshCAsgASACQQFqIgMgASADSxshByACIAEgBhshAwNAAkACQCADIAJGDQAgACACaiwAAEG/f0wNAQwGCyADIAEjgYCAgABB1JTBgABqEICCgIAAAAsgAkEBaiICIAFJDQALIAchAgwDCyAFI4mAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQfaBwIAAaiAFQRhqIAQQ94GAgAAACyAFI4mAgIAArUIghiIJIAVBCGqthDcDICAFIAkgBUEEaq2ENwMYI4GAgIAAQbOCwIAAaiAFQRhqIAQQ94GAgAAACyAFI4mAgIAArUIghiIJIAVBBGqthDcDICAFIAkgBa2ENwMYI4GAgIAAQZiBwIAAaiAFQRhqIAQQ94GAgAAACyAFIAg2AgwgBSACNgIQAkAgCCACSw0AIAIgAUsNAAJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAgsgAiABRg0AIAAgAmosAABBv39MDQELIAggAkYNAgJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSOWgICAAK1CIIYgBUEUaq2ENwMgIAUjiYCAgACtQiCGIAWthDcDGCAFI4KAgIAAQcCAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQaqOwIAAaiAFQRhqIAQQ94GAgAAACyAAIAEgCCACIAQQiIKAgAAACyADRQ0CIAMgAU8NAiAAIANqLAAAQb9/Sg0CAkAgACADQX9qIghqLAAAQb9/Sg0AIANBfmoiAiADQX1qIAAgAmosAABBv39KGyEICyABIANBAWoiAiABIAJLGyEGIAMgASAHGyECAkADQAJAAkAgAiADRg0AIAAgA2osAABBv39MDQEMAwsgAiABI4GAgIAAQdSUwYAAahCAgoCAAAALIANBAWoiAyABSQ0ACyAGIQMLIAUgCDYCDCAFIAM2AhAgCCADSw0BIAMgAUsNAQJAIAggAUYNAAJAIAhFDQAgACAIaiwAAEG/f0wNAwsgAyABRg0AIAAgA2osAABBv39MDQILIAggA0YNAAJAAkAgACAIaiICLAAAIgNBf0wNACADQf8BcSEDDAELIAItAAFBP3EhASADQR9xIQACQCADQV9LDQAgAEEGdCABciEDDAELIAFBBnQgAi0AAkE/cXIhAQJAIANBcE8NACABIABBDHRyIQMMAQsgAUEGdCACLQADQT9xciAAQRJ0QYCA8ABxciEDCyAFIAM2AhQgBSOWgICAAK1CIIYgBUEUaq2ENwMgIAUjiYCAgACtQiCGIAVBBGqthDcDGCAFI4KAgIAAQcCAgIAAaq1CIIYgBUEMaq2ENwMoI4GAgIAAQfyOwIAAaiAFQRhqIAQQ94GAgAAACyAEEIyCgIAAAAsgACABIAggAyAEEIiCgIAAAAsgBSOJgICAAK1CIIYiCSAFQQhqrYQ3AyAgBSAJIAVBBGqthDcDGCOBgICAAEGzgsCAAGogBUEYaiAEEPeBgIAAAAvIAQEEfyOAgICAAEEQayICJICAgIAAQQEhAwJAIAEoAgAiBEEnIAEoAgQiBSgCECIBEYSAgIAAgICAgAANACACIAAoAgBBgQIQ+YGAgAACQAJAIAItAA0iA0GBAUkNACAEIAIoAgAgARGEgICAAICAgIAARQ0BQQEhAwwCCyAEIAIgAi0ADCIAaiADIABrIAUoAgwRg4CAgACAgICAAEUNAEEBIQMMAQsgBEEnIAERhICAgACAgICAACEDCyACQRBqJICAgIAAIAMLhgUBA38jgICAgABBEGsiAiSAgICAAAJAAkACQAJAIAEoAggiA0GAgIAQcQ0AIANBgICAIHENASAAIAEQh4KAgABFDQJBASEEDAMLIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQdCDwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABB5ovBgABqQQIgAkEIaiADakEIakEAIANrEIKCgIAARQ0BDAILIAAoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQeiLwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALQQEhBCABQQEjgYCAgABB5ovBgABqQQIgAkEIaiADakEIakEAIANrEIKCgIAADQELI4GAgIAAIQMCQCABKAIAIANB5IvBgABqQQIgASgCBCgCDBGDgICAAICAgIAARQ0AQQEhBAwBCyAAQQRqIQMCQAJAIAEoAggiBEGAgIAQcQ0AIARBgICAIHENASADIAEQh4KAgAAhBAwCCyADKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEHQg8GAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0ACyABQQEjgYCAgABB5ovBgABqQQIgAkEIaiADakEIakEAIANrEIKCgIAAIQQMAQsgAygCACEEQQAhAwNAIAJBCGogA2pBB2ojgYCAgABB6IvBgABqIARBD3FqLQAAOgAAIANBf2ohAyAEQQR2IgQNAAsgAUEBI4GAgIAAQeaLwYAAakECIAJBCGogA2pBCGpBACADaxCCgoCAACEECyACQRBqJICAgIAAIAQLGgAjgYCAgABB4IPBgABqQSsgABDzgYCAAAALWAEBfyOAgICAAEEQayIDJICAgIAAIAMgATYCBCADIAA2AgAgAyOCgICAAEG+gICAAGqtQiCGIAOthDcDCCOBgICAAEHOhMCAAGogA0EIaiACEPeBgIAAAAscACAAKAIAIAEgACgCBCgCDBGEgICAAICAgIAACxwAIAEoAgAgASgCBCAAKAIAIAAoAgQQ9oGAgAALpgIBBX8CQAJA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cm93bi0wLjE3LjEvc3JjL3Jhdy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQvc2hhcmVkL3NtYWxsc29ydC5ycwAvaG9tZS9sYWIvLnJ1c3R1cC90b29sY2hhaW5zL3N0YWJsZS14ODZfNjQtdW5rbm93bi1saW51eC1nbnUvbGliL3J1c3RsaWIvc3JjL3J1c3QvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3N0YWJsZS9xdWlja3NvcnQucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL211dGV4L25vX3RocmVhZHMucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3N5cy9zeW5jL3J3bG9jay9ub190aHJlYWRzLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvaW8vd3JpdGUucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby93cml0ZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvc3RyL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjL21vZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2lkLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vaW9fc2xpY2UvcmVwcl9pb3ZlYy5ycwBwYWNrYWdlcy93YXNtL3NjZW5lM2Qvc3JjL2xpYi5ycwAvABFzdGFydCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAPZW5kIGJ5dGUgaW5kZXggwCYgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlIMAIIChieXRlcyDACyBvZiBzdHJpbmcpABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDARyBieXRlcyBmYWlsZWQKc2tpcHBpbmcgYmFja3RyYWNlIHByaW50aW5nIHRvIGF2b2lkIHBvdGVudGlhbCByZWN1cnNpb24KADVmYXRhbCBydW50aW1lIGVycm9yOiBmYWlsZWQgdG8gaW5pdGlhdGUgcGFuaWMsIGVycm9yIMALLCBhYm9ydGluZwoAFW1lbW9yeSBhbGxvY2F0aW9uIG9mIMAOIGJ5dGVzIGZhaWxlZAoADHBhbmlja2VkIGF0IMACOgrAMwp0aHJlYWQgcGFuaWNrZWQgd2hpbGUgcHJvY2Vzc2luZyBwYW5pYy4gYWJvcnRpbmcuCgAJCnRocmVhZCAnwAMnICjADikgcGFuaWNrZWQgYXQgwAI6CsABCgAZYWJvcnRpbmcgZHVlIHRvIHBhbmljIGF0IMACOgrAAQoAIzliYjBmZiNhYWJmZmYjYzlkNmZmI2Y4ZjlmZiNmZmYyZGYjZmZkOWEwI2ZmYjQ2YyNmZjlhNTVwbGFuZXQjN2ZiOGRkI2E4YzZlMCNkOWM0OWEjYzk4YTVhI2IwNmE0ZiM4ZDlkYjYjZTBkM2I4I2MxNTczYgAAAAAAAABtaWQgPiBsZW5mYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHdoZW4gdGhlIHVuZGVybHlpbmcgc3RyZWFtIGRpZCBub3RmaWxlIG5hbWUgY29udGFpbmVkIGFuIHVuZXhwZWN0ZWQgTlVMIGJ5dGVtYWluPHVubmFtZWQ+bm90ZTogcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPTFgIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGRpc3BsYXkgYSBiYWNrdHJhY2UKXPbpX9wC9rnxwXBs8mHBJA8nZvGiFQSKTKfz/XYC33FmYXRhbCBydW50aW1lIGVycm9yOiByd2xvY2sgbG9ja2VkIGZvciB3cml0aW5nLCBhYm9ydGluZwpyd2xvY2sgb3ZlcmZsb3dlZCByZWFkIGxvY2tzUlVTVF9CQUNLVFJBQ0VjYW5ub3QgcmVjdXJzaXZlbHkgYWNxdWlyZSBtdXRleGFkdmFuY2luZyBJb1NsaWNlIGJleW9uZCBpdHMgbGVuZ3RoYWR2YW5jaW5nIGlvIHNsaWNlcyBiZXlvbmQgdGhlaXIgbGVuZ3RoAEJveDxkeW4gQW55PnRocmVhZCBjYXVzZWQgbm9uLXVud2luZGluZyBwYW5pYy4gYWJvcnRpbmcuCnN0YWNrIGJhY2t0cmFjZToKbm90ZTogU29tZSBkZXRhaWxzIGFyZSBvbWl0dGVkLCBydW4gd2l0aCBgUlVTVF9CQUNLVFJBQ0U9ZnVsbGAgZm9yIGEgdmVyYm9zZSBiYWNrdHJhY2UuCmZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXJzdHJlcnJvcl9yIGZhaWx1cmVmYWlsZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIHRocmVhZCBJRDogYml0c3BhY2UgZXhoYXVzdGVkcndsb2NrIGhhcyBub3QgYmVlbiBsb2NrZWQgZm9yIHJlYWRpbmciAQgJKw0rKyscKysGAgMeKysaDCsbBCsrJyMUKSsPEiggKyshCisFKCsrACsrKyYrKxgkBw4QKyskKysrKwELKysrKxEZKxMWHR9IYXNoIHRhYmxlIGNhcGFjaXR5IG92ZXJmbG93AAAAAAAAAAAAAAMAAAAEAAAABAAAAAYAAACD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AAAAAEDnPwAAAAAAAAAAAMhxwo1x1D911mcJzicvvQAAAAAAIOc/AAAAAAAAAAAAMBee4MnUP6TYChuJIC69AAAAAAAA5z8AAAAAAAAAAACgOAeuItU/WcdkgXC+Lj0AAAAAAODmPwAAAAAAAAAAANDIU/d71T/vQF3u7a0fPQAAAAAAwOY/AAAAAAAAAAAAYFnfvdXVP9xlpAgqCwq9U3VjY2VzcwBJbGxlZ2FsIGJ5dGUgc2VxdWVuY2UARG9tYWluIGVycm9yAFJlc3VsdCBub3QgcmVwcmVzZW50YWJsZQBOb3QgYSB0dHkAUGVybWlzc2lvbiBkZW5pZWQAT3BlcmF0aW9uIG5vdCBwZXJtaXR0ZWQATm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQBObyBzdWNoIHByb2Nlc3MARmlsZSBleGlzdHMAVmFsdWUgdG9vIGxhcmdlIGZvciBkYXRhIHR5cGUATm8gc3BhY2UgbGVmdCBvbiBkZXZpY2UAT3V0IG9mIG1lbW9yeQBSZXNvdXJjZSBidXN5AEludGVycnVwdGVkIHN5c3RlbSBjYWxsAFJlc291cmNlIHRlbXBvcmFyaWx5IHVuYXZhaWxhYmxlAEludmFsaWQgc2VlawBDcm9zcy1kZXZpY2UgbGluawBSZWFkLW9ubHkgZmlsZSBzeXN0ZW0ARGlyZWN0b3J5IG5vdCBlbXB0eQBDb25uZWN0aW9uIHJlc2V0IGJ5IHBlZXIAT3BlcmF0aW9uIHRpbWVkIG91dABDb25uZWN0aW9uIHJlZnVzZWQASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAE5vdCBzdXBwb3J0ZWQAQWRkcmVzcyBmYW1pbHkgbm90IHN1cHBvcnRlZCBieSBwcm90b2NvbABBZGRyZXNzIG5vdCBhdmFpbGFibGUATmV0d29yayBpcyBkb3duAE5ldHdvcmsgdW5yZWFjaGFibGUAQ29ubmVjdGlvbiByZXNldCBieSBuZXR3b3JrAENvbm5lY3Rpb24gYWJvcnRlZABObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlAFNvY2tldCBpcyBjb25uZWN0ZWQAU29ja2V0IG5vdCBjb25uZWN0ZWQAT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFF1b3RhIGV4Y2VlZGVkAE11bHRpaG9wIGF0dGVtcHRlZABDYXBhYmlsaXRpZXMgaW5zdWZmaWNpZW50AAAAAAAAAAAAAAB1Ak4A1gHiBLkEGAGOBe0CFgTyAJcDAQM4Ba8BggFPAy8EHgDUBaIAEgMeA8IB3gMIAKwFAAFkAvEBZQU0AowCzwItA0wE4wWfAvgEHAUI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DwAAAAAABQAAAABwAAcALQEBAQIBAgEBSAswFRABZQcCBgICAQQjAR4bWws6CQkBGAQBCQEDAQUrAzsJKhgBIDcBAQEECAQBAwcKAh0BOgEBAQIECAEJAQoCGgECAjkBBAIEAgIDAwEeAgMBCwI5AQQFAQIEARQCFgYBAToBAQIBBAgBBwMKAh4BOwEBAQwBCQEoAQMBNwEBAwUDAQQHAgsCHQE6AQICAQEDAwEEBwILAhwCOQIBAQIECAEJAQoCHQFIAQQBAgMBAQgBUQECBwwIYgECCQsHSQIbAQEBAQE3DgEFAQIFCwEkCQFmBAEGAQICAhkCBAMQBA0BAgIGAQ8BAAMABBwDHQIeAkACAQcIAQILCQEtAwEBdQIiAXYDBAIJAQYD2wICAToBAQcBAQEBAggGCgIBMC4CDBQEMAoEAyYJDAIgBAIGOAEBAgMBAQU4CAICmAMBDQEHBAEGAQMCxkAAAcMhAAONAWAgAAZpAgAEAQogAlACAAEDAQQBGQIFAZcCGhINASYIGQsBASwDMAECBAICAgEkAUMGAgICAgwBCAEvATMBAQMCAgUCAQEqAggB7gECAQQBAAEAEBAQAAIAAeIBlQUAAwECBQQoAwQBpQIABEEFAAJNBkYLMQR7ATYPKQECAgoDMQQCAgcBPQMkBQEIPgEMAjQJAQEIBAIBXwMCBAYBAgGdAQMIFQI5AgEBAQEMAQkBDgcDBUMBAgYBAQIBAQMEAwEBDgJVCAIDAQEXAVEBAgYBAQIBAQIBAusBAgQGAgECGwJVCAIBAQJqAQEBAghlAQEBAgQBBQAJAQL1AQoEBAGQBAICBAEgCigGAgQIAQkGAgMuDQECxgEBAwEByQcBBgEBUhYCBwECAQJ6BgMBAQIBBwEBSAIDAQEBAAILAjQFBQMXAQABBg8ADAMDAAU7BwABPwRRAQsCAAIALgIXAAUDBggIAgceBJQDADcEMggBDgEWBQEPAAcBEQIHAQIBBWQBoAcAAT0EAAT+AvMBAgEHAgUBAAdtBwBggPAArQEAAQABAAIAAlUFAAUaBTEQAAEAEO8BoAFPCQAEAAgAAACtAQAGFgHAATEBAAJQAQABAAUaBTEFAQoAAfkDAAEPAQAQAAQACAABHmAAMDEyMzQ1Njc4OWFiY2RlZmNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24g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");
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
		postReturn0 = exports1["cabi_post_build-fleet-scene"];
		try {
			WebAssembly.promising(exports1["cabi_post_build-fleet-scene"]);
		} catch {
			exports1["cabi_post_build-fleet-scene"];
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
