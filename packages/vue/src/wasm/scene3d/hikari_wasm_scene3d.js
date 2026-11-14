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
		let module0 = base64Compile(_jcoBase64CompileContext, "AGFzbQEAAAABswEbYAF/AX9gAn9/AGAEf39/fwBgA39/fwF/YAJ/fwF/YAZ/f39/f38Bf2ABfwBgA39/fwBgAAF/YAF+AX9gAABgBX9/f39/AGADfn5/AX5gBn9/f39/fwBgBH9/f38Bf2AHf39/f39/fwBgA39/fABgAnx8AXxgBX9/f39/AX9gAnx/AX9gA3x8fwF8YAF8AXxgAn98AXxgAX8BfGADfH5+AXxgAnx/AXxgCH9/f39/f39/AAKdCBYgd2FzaTpyYW5kb20vaW5zZWN1cmUtc2VlZEAwLjIuMTINaW5zZWN1cmUtc2VlZAAGE3dhc2k6aW8vZXJyb3JAMC4yLjAUW3Jlc291cmNlLWRyb3BdZXJyb3IABhJ3YXNpOmlvL3BvbGxAMC4yLjAXW3Jlc291cmNlLWRyb3BdcG9sbGFibGUABhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAbW3Jlc291cmNlLWRyb3BdaW5wdXQtc3RyZWFtAAYVd2FzaTppby9zdHJlYW1zQDAuMi4wHFtyZXNvdXJjZS1kcm9wXW91dHB1dC1zdHJlYW0ABh13YXNpOmNsaS90ZXJtaW5hbC1pbnB1dEAwLjIuMB1bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1pbnB1dAAGHndhc2k6Y2xpL3Rlcm1pbmFsLW91dHB1dEAwLjIuMB5bcmVzb3VyY2UtZHJvcF10ZXJtaW5hbC1vdXRwdXQABhp3YXNpOmNsaS9lbnZpcm9ubWVudEAwLjIuMA9nZXQtZW52aXJvbm1lbnQABhN3YXNpOmNsaS9leGl0QDAuMi4wBGV4aXQABhJ3YXNpOmlvL3BvbGxAMC4yLjAWW21ldGhvZF1wb2xsYWJsZS5ibG9jawAGEndhc2k6aW8vcG9sbEAwLjIuMARwb2xsAAcVd2FzaTppby9zdHJlYW1zQDAuMi4wIVttZXRob2Rdb3V0cHV0LXN0cmVhbS5jaGVjay13cml0ZQABFXdhc2k6aW8vc3RyZWFtc0AwLjIuMBtbbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUAAhV3YXNpOmlvL3N0cmVhbXNAMC4yLjAkW21ldGhvZF1vdXRwdXQtc3RyZWFtLmJsb2NraW5nLWZsdXNoAAEVd2FzaTppby9zdHJlYW1zQDAuMi4wH1tt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HyADQeQAaioCACEgIANB4ABqKgIAISEgA0HcAGoqAgAhIiADQdgAaioCACEjIANB1ABqKgIAISQgA0HQAGoqAgAhJSADQcwAaioCACEmIANByABqKgIAIScgA0HEAGoqAgAhKCADQcAAaioCACEpIANBPGoqAgAhKiADQThqKAIAIQogA0E0aigCACErIANBMGooAgAhECADQSxqKAIAIQggA0EoaigCACEsIANBJGooAgAhDyADQSBqKAIAIQcgA0EcaigCACEAIANBGGooAgAhDSADQRRqKAIAIQYgA0EQaigCACEBIANBDGooAgAhCSADQfQAai0AACEtIANBBGopAgAiEqchEwJAAkAgCyASQiCIIhKnIhFLDQAgEyEFDAELAkAgEkIAUg0AQQEhBSATIAtBARC2gICAAAwBCyATIAtBASARELeAgIAAIgVFDQYLIAQgBTYCACAEQQRqIBE2AgACQAJAIAkgBksNACABIQsMAQsCQCAGDQBBASELIAEgCUEBELaAgIAADAELIAEgCUEBIAYQt4CAgAAiC0UNBwsgBEEIaiALNgIAIARBDGogBjYCAAJAAkAgDSAHSw0AIAAhBgwBCwJAIAcNAEEBIQYgACANQQEQtoCAgAAMAQsgACANQQEgBxC3gICAACIGRQ0ICyAEQRhqIC06AAAgBEEQaiAGNgIAIARBFGogBzYCAAJAAkAgDyAISw0AICwhBgwBCwJAIAgNAEEBIQYgLCAPQQEQtoCAgAAMAQsgLCAPQQEgCBC3gICAACIGRQ0JCyAEQRxqIAY2AgAgBEEgaiAINgIAAkACQCAQIApLDQAgKyEGDAELAkAgCg0AQQEhBiArIBBBARC2gICAAAwBCyArIBBBASAKELeAgIAAIgZFDQoLIARB4ABqIB02AgAgBEHcAGogHjYCACAEQdgAaiAfOAIAIARB1ABqICA4AgAgBEHQAGogITgCACAEQcwAaiAiOAIAIARByABqICM4AgAgBEHEAGogJDgCACAEQcAAaiAlOAIAIARBPGogJjgCACAEQThqICc4AgAgBEE0aiAoOAIAIARBMGogKTgCACAEQSxqICo4AgAgBEEkaiAGNgIAIARBKGogCjYCACAEQeQAaiEEIANB+ABqIgMgG0cNAAwDCwsgA0H4AGohAwsgGyADa0H4AG4hBCAbIANGDQADQCADEJ2AgIAAIANB+ABqIQMgBEF/aiIEDQALCwJAIBhFDQAgGSAYQfgAbEEEELaAgIAACyOBgICAAEGQlcGAAGoiAyAcNgIAIAMgGjYCBCACQTBqQQQgFUHkAGwQuoCAgAAgFyAVQfgAbGohGyACKAIwIRkgFyEDAkACQCAVRQ0AIBkhBCAXIQMCQANAIAMoAgAiC0F/Rg0BIANB8ABqKAIAIR0gA0HsAGooAgAhHiADQegAaioCACEfIANB5ABqKgIAISAgA0HgAGoqAgAhISADQdwAaioCACEiIANB2ABqKgIAISMgA0HUAGoqAgAhJCADQdAAaioCACElIANBzABqKgIAISYgA0HIAGoqAgAhJyADQcQAaioCACEoIANBwABqKgIAISkgA0E8aioCACEqIANBOGooAgAhCiADQTRqKAIAISsgA0EwaigCACEQIANBLGooAgAhCCADQShqKAIAIS0gA0EkaigCACEPIANBIGooAgAhByADQRxqKAIAIQAgA0EYaigCACENIANBFGooAgAhBiADQRBqKAIAIQEgA0EMaigCACEJIANB9ABqLQAAISwgA0EEaikCACISpyETAkACQCALIBJCIIgiEqciEUsNACATIQUMAQsCQCASQgBSDQBBASEFIBMgC0EBELaAgIAADAELIBMgC0EBIBEQt4CAgAAiBUUNCwsgBCAFNgIAIARBBGogETYCAAJAAkAgCSAGSw0AIAEhCwwBCwJAIAYNAEEBIQsgASAJQQEQtoCAgAAMAQsgASAJQQEgBhC3gICAACILRQ0MCyAEQQhqIAs2AgAgBEEMaiAGNgIAAkACQCANIAdLDQAgACEGDAELAkAgBw0AQQEhBiAAIA1BARC2gICAAAwBCyAAIA1BASAHELeAgIAAIgZFDQ0LIARBGGogLDoAACAEQRBqIAY2AgAgBEEUaiAHNgIAAkACQCAPIAhLDQAgLSEGDAELAkAgCA0AQQEhBiAtIA9BARC2gICAAAwBCyAtIA9BASAIELeAgIAAIgZFDQ4LIARBHGogBjYCACAEQSBqIAg2AgACQAJAIBAgCksNACArIQYMAQsCQCAKDQBBASEGICsgEEEBELaAgIAADAELICsgEEEBIAoQt4CAgAAiBkUNDwsgBEHgAGogHTYCACAEQdwAaiAeNgIAIARB2ABqIB84AgAgBEHU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H2ojgYCAgABB1pTAgABqQZ0BENaAgIAAIAJBEGoQv4CAgAALIAFBADoAAAwBCyACIAE2AgwgAiAFIAJBDGqthDcDECACQQRqIAJBH2ojgYCAgABBzI/AgABqIAJBEGoQ1oCAgAAgAkEEahC/gICAAAsgAkEgaiSAgICAAAsJABDlgICAAAALvAIDAn8BfgF/I4CAgIAAQSBrIgMkgICAgAAQ0oCAgAAhBCAAKQIAIQUgAyACNgIYIAMgATYCFCADIAU3AgwCQAJAI4uAgIAAKAIAIgZBAksNACADQQxqQQAQzICAgAAMAQsgAyAGQXhqNgIcIANBDGogA0EcahDMgICAAAsCQAJAAkACQCAAKAIILQAADgMAAQIDCyADQQxqIAEgAigCJEEAENOAgIAAIANBDGoQv4CAgAAMAgsgA0EMaiABIAIoAiRBARDTgICAACADQQxqEL+AgIAADAELI4GAgIAAQYSRwYAAaiIALQAAIQYgAEEAOgAAIAZFDQAgA0EMaiABI4GAgIAAQdaUwIAAakGdASACKAIkEYKAgIAAgICAgAAgA0EMahC/gICAAAsgBEEAOgAAIANBIGokgICAgAALjgEBA38jgICAgABBEGsiACSAgICAACOBgICAAEGJlsGAAGoiAS0AACECIAFBAToAACAAIAI6AA8CQCACQQFHDQAjgYCAgAAhAkEAIABBD2ojjICAgAAgAkGnlsCAAGpBwQAgAkHEkMGAAGoQvYCAgAAACyOBgICAACECIABBEGokgICAgAAgAkGJlsGAAGoLYAEBfyOAgICAAEEQayIEJICAgIAAIAQgAzoAByAEI42AgIAArUIghiAEQQdqrYQ3AwggACABI4GAgIAAQc6EwIAAaiAEQQhqIAIRgoCAgACAgICAACAEQRBqJICAgIAAC5gDAQN/I4CAgIAAQTBrIgEkgICAgABB/wEhAgJAIAAtAA0NAEEBIQIjgYCAgABBrJXBgABqKAIAQQFLDQAQ5ICAgAAhAgsgASACOgALIAEgACgCCDYCDCABIAAoAgAgACgCBBDmgICAACABIAEpAwA3AhAjgYCAgABB5JXBgABqLQAAIQAgASABQQtqNgIgIAEgAUEQajYCHCABIAFBDGo2AhgCQAJAAkAgAEUNACOBgICAACIAQeSVwYAAakEBOgAAIABBqJXBgABqIgIoAgAhACACQQA2AgAgAA0BCyABQRhqIAFBL2ojgYCAgABBiJHBgABqENGAgIAADAELI4GAgIAAIQIgAUEYaiAAQQhqEOGAgIAAIgNBBGogAkGwkcGAAGoQ0YCAgAAgA0EAOgAAIAJB5JXBgABqQQE6AAAgAkGolcGAAGoiAygCACECIAMgADYCACABIAI2AiggAUEBNgIkIAJFDQAgAiACKAIAIgBBf2o2AgAgAEEBRw0AIAFBJGpBBGoQ4oCAgAALIAFBMGokgICAgAALbgEBfyOAgICAAEEgayICJICAgIAAIAIgACABELyAgIAANgIEIAIjiYCAgACtQiCGIAJBBGqthDcDECACQQhqIAJBH2ojgYCAgABBrJDAgABqIAJBEGoQ1oCAgAAgAkEIahC/gICAABDQgICAAAALuQEBAX8jgICAgABBEGsiBCSAgICAACAAQf8BOgAAIAQgATYCCCAEIAApAgA3AwAgBCOBgICAAEGYj8GAAGogAiADEPaBgIAAIQEgBC0AACEDAkACQAJAIAFFDQAgA0H/AXFB/wFHDQEjgYCAgAAiBEHJk8CAAGpBrQEgBEHwjsGAAGoQ94GAgAAACyADQf8BcUEDRw0BIARBBHIQloKAgAAMAQsgACAEKQMANwIACyAEQRBqJICAgIAAC3EBAX8jgICAgABBEGsiAiSAgICAAAJAAkACQCABQQhLDQAgASAATQ0BCyACQQA2AgwgAkEMaiABQQQgAUEESxsgABDlgYCAACEBQQAgAigCDCABGyEBDAELIAAQ3YGAgAAhAQsgAkEQaiSAgICAACABCwkAENCAgIAAAAsKACAAEOCBgIAAC50BAQJ/I4CAgIAAQRBrIgQkgICAgAACQAJAAkAgAkEISw0AIAIgA00NAQtBACEFIARBADYCDCAEQQxqIAJBBCACQQRLGyADEOWBgIAADQEgBCgCDCICRQ0BAkAgAyABIAMgAUkbIgNFDQAgAiAAIAP8CgAACyAAEOCBgIAAIAIhBQwBCyAAIAMQ44GAgAAhBQsgBEEQaiSAgICAACAFCzgCAX8BfiOAgICAAEEQayIBJICAgIAAIAApAgAhAiABIAA2AgwgASACNwIEIAFBBGoQxoCAgAAAC4oBAQJ/I4CAgIAAQRBrIgIkgICAgAACQAJAAkAgAUEISw0AIAEgAE0NAQtBACEDIAJBADYCDCACQQxqIAFBBCABQQRLGyAAEOWBgIAADQEgAigCDCIBRQ0BAkAgAEUNACABQQAgAPwLAAsgASEDDAELIABBARDigYCAACEDCyACQRBqJICAgIAAIAMLDQAgASAAEN6AgIAAAAsvAQF/I4CAgIAAQRBrIgIkgICAgAAgAiABNgIMIAIgADYCCCACQQhqEMSAgIAAAAvvAQIDfwF+I4CAgIAAQRBrIgIkgICAgAAgASgCBCEDIAEoAgAhBCAALQAAIQAgAkEEahDjgICAACACKQIIIQUCQCACKAIEIgFBf0cNACAFQv8Bg0IDUg0AIAJBDGoQloKAgAALAkACQAJAAkAgBCOBgICAAEHLl8CAAGpBESADKAIMIgMRg4CAgACAgICAAA0AIABBAXENASAEI4GAgIAAQdyXwIAAakHYACADEYOAgIAAgICAgABFDQELQQEhBCABQQBKDQEMAgtBACEEIAFBAEwNAQsgBacgAUEBELaAgIAACyACQRBqJICAgIAAIAQL8QIBAn8jgICAgABBoANrIgMkgICAgAACQAJAAkACQCACQf8CSw0AAkAgAkUNACADQRRqIAEgAvwKAAALIANBFGogAmpBADoAACADQZQDaiADQRRqIAJBAWoQgYKAgAACQCADKAKUA0EBRw0AQX4hAiADQX42AgggAyOBgICAAEHAj8GAAGopAwA3AgwMAgsCQCADKAKYAxDCgYCAACIBRQ0AAkACQCABENqBgIAAIgINAEEBIQQMAQsQuYCAgAAgAkEBELWAgIAAIgRFDQQgAkUNACAEIAEgAvwKAAALIAMgAjYCECADIAQ2AgwgAyACNgIIDAILQX8hAiADQX82AggMAQsgA0EIaiABIAIQyoCAgAAgAygCCCECCwJAIAJBfkYNACAAIAMpAgw3AgQgACACNgIADAILAkAgAy0ADEEDRw0AIANBEGoQloKAgAALIABBfzYCAAwBC0EBIAIQ6YGAgAAACyADQaADaiSAgICAAAtyAQJ/I4CAgIAAQRBrIgEkgICAgAAgAC0AACECIABBAToAACABIAI6AA8CQCACQQFHDQAjgYCAgAAhAEEAIAFBD2ojjICAgAAgAEGnlsCAAGpBwQAgAEHEkMGAAGoQvYCAgAAACyABQRBqJICAgIAAIAALVwEBfwJAIAAoAgAiAEEMaigCACIBRQ0AIABBEGooAgAgAUEBELaAgIAACwJAIABBf0YNACAAIAAoAgQiAUF/ajYCBCABQQFHDQAgAEEYQQQQtoCAgAALC4sDAQZ/I4CAgIAAQRBrIgEkgICAgAAQuYCAgABBgAQhAgJAAkACQAJAQYAEQQEQtYCAgAAiA0UNACABIAM2AgggAUGABDYCBAJAAkAgA0GABBCcgYCAAA0AQYAEIQIDQCOBgICAACEEI46AgIAAKAIAIQUjj4CAgAAoAgAhBgJAIAUgBEGokMGAAGpGDQAjgYCAgABBqJDBgABqEJSCgIAACyAGQcQARw0CIAEgAjYCDCABQQRqIAJBAUEBQQEQyYCAgAAgASgCCCIDIAEoAgQiAhCcgYCAAEUNAAsLIAEgAxDagYCAACIGNgIMIAIgBk0NAwJAIAYNAEEBIQQgAyACQQEQtoCAgAAMAwsgAyACQQEgBhC3gICAACIEDQJBASAGEOmBgIAAAAsgAEF/NgIAIAAgBq1CIIY3AgQgAkUNAyADIAJBARC2gICAAAwDC0EBQYAEEOmBgIAAAAsgASAGNgIEIAEgBDYCCAsgACABKAIMNgIIIAAgASkCBDcCAAsgAUEQaiSAgICAAAukAgEFfyOAgICAAEEQayIAJICAgIAAQQMhAQJAI4GAgIAAQdSVwYAAai0AAEF/aiICQf8BcUEDSQ0AIABBBGojgYCAgABBmZbAgABqQQ4Q4ICAgAACQAJAIAAoAgQiA0F/Rw0AQQIhAgwBCwJAAkACQAJAIAAoAgxBf2oOBAACAgECCyAAKAIIIgQtAABBMEcNAUEDIQFBAiECIAMNAgwDCyAAKAIIIgQoAABB5uqx4wZHDQBBAiEBQQEhAiADDQEMAgtBASEBQQAhAiADRQ0BIAAoAgghBAsgBCADQQEQtoCAgAALI4GAgIAAQdSVwYAAaiIDIAMtAAAiAyABIAMbOgAAIANFDQAgA0F/akF/IANBBEkbIQILIABBEGokgICAgAAgAgsJABCbgYCAAAAL8gECA38CfiOAgICAAEEQayIDJICAgIAAIAMgASACKAIMIgQRgYCAgACAgICAAEEEIQIgASEFAkACQCADKQMAQtzsp//F24D7uX+FIAMpAwhC8YPD46a+2OAkhYRQDQAgAyABIAQRgYCAgACAgICAACADKQMIIQYgAykDACEHI4GAgIAAIQICQCAHQo/OmIuvtIWCin+FIAZCzM7O7+/OwO/xAIWEQgBRDQAgAkGSl8CAAGohAUEMIQIMAgsgAUEEaiEFQQghAgsgASACaigCACECIAUoAgAhAQsgACACNgIEIAAgATYCACADQRBqJICAgIAAC9oCAQV/I4CAgIAAQRBrIgQkgICAgAACQAJAIANFDQAgBEEMaiEFA0ACQAJAAkACQAJAQQIgAiADEJeBgIAAIgZBf0cNACOBgICAACEHI46AgIAAKAIAIQgjj4CAgAAoAgAhBgJAIAggB0GokMGAAGpGDQAjgYCAgABBqJDBgABqEJSCgIAACyAEQQA6AAsgBEEAOwAJIAQgBjYCDCAEQQA6AAggBhCRgoCAACgCCBGAgICAAICAgIAADQMgBEEIaiEGDAELIARB/wE6AAggBCAGNgIMI4GAgIAAIQcgBg0BIAdB6JHBgABqIQYLIAAgBikCADcCAAwFCwJAIAMgBkkNACACIAZqIQIgAyAGayEDDAILIAYgAyADI4GAgIAAQcCSwYAAahD4gYCAAAALIAQtAAhBA0cNACAFEJaCgIAACyADDQALCyAAQf8BOgAACyAEQRBqJICAgIAAC20BAn8jkICAgAAiASABKAIAIgJBAWo2AgBBACEBAkAgAkEASA0AQQEhASOBgICAAEGwlcGAAGotAAANACOBgICAACIBQbCVwYAAaiAAOgAAIAFBrJXBgABqIgEgASgCAEEBajYCAEECIQELIAELHAAgACgCACABIAAoAgQoAgwRhICAgACAgICAAAsKACAAEJOBgIAACwcAIABBG0YLLwEBf0ErIQECQCAAQX9qIgBBygBLDQAjgYCAgABBv5nAgABqIABqLQAAIQELIAELJQEBfyAAI4GAgIAAQbSVwIAAaiICKQIINwIIIAAgAikCADcCAAslAQF/IAAjgYCAgABBpJXAgABqIgIpAgg3AgggACACKQIANwIAC8EBBAN/AX4CfwF+QQAhAwJAQQAgACgCCCIEKAIEIgUgBCkDCCIGQv////8PIAZC/////w9UG6drIgcgByAFSxsiByACIAcgAkkbIghFDQAgBCgCACAGIAWtIgkgBiAJVBunaiABIAj8CgAACyAEIAYgCK18NwMIAkAgByACTw0AI4GAgIAAQeiRwYAAaikDACIGQv8Bg0L/AVENAAJAIAAtAABBA0cNACAAQQRqEJaCgIAACyAAIAY3AgBBASEDCyADC2MBAX8CQAJAAkAgAiAAKAIIIgAoAgAgACgCCCIDa00NACAAIAMgAkEBQQEQyYCAgAAgACgCCCEDDAELIAJFDQELIAJFDQAgACgCBCADaiABIAL8CgAACyAAIAMgAmo2AghBAAtpAQF/I4CAgIAAQRBrIgMkgICAgAAgA0EIaiADIAEgAhDngICAAAJAIAMtAAgiAkH/AUYNAAJAIAAtAABBA0cNACAAQQRqEJaCgIAACyAAIAMpAwg3AgALIANBEGokgICAgAAgAkH/AUcLtwUBCH8jgICAgABBEGsiBCSAgICAAAJAAkACQAJAAkACQCADRQ0AIAJBBGohBSADQQN0IgZBeGpBA3ZBAWohB0EAIQgCQANAIAUoAgANASAFQQhqIQUgCEEBaiEIIAZBeGoiBg0ACyAHIQgLIAMgCEkNAiADIAhGDQAgAyAIayEHIAIgCEEDdGohCSAEQQhqQQRqIQoDQAJAAkBBAiAJIAdBECAHQRBJGxCWgYCAACIFQX9HDQAjgYCAgAAhCCOOgICAACgCACEGI4+AgIAAKAIAIQUCQCAGIAhBqJDBgABqRg0AI4GAgIAAQaiQwYAAahCUgoCAAAsgBEEAOgALIARBADsACSAEIAU2AgwgBEEAOgAIIAUQkYKAgAAoAggRgICAgACAgICAAA0BIARBCGohBQwHCyAEQf8BOgAIIAQgBTYCDCOBgICAACEIAkAgBQ0AIAhB6JHBgABqIQUMBwsgCUEEaiEIIAdBA3QiA0F4akEDdkEBaiELQQAhBgJAA0AgBSAIKAIAIgJJDQEgCEEIaiEIIAZBAWohBiAFIAJrIQUgA0F4aiIDDQALIAshBgsgByAGSQ0FIAkgBkEDdGohCQJAIAcgBkcNAEEAIQcgBUUNASOBgICAACIFQeqWwIAAakHPACAFQeSQwYAAahD3gYCAAAALIAkoAgQiCCAFSQ0DIAcgBmshByAJIAggBWs2AgQgCSAJKAIAIAVqNgIACwJAIAQtAAhBA0cNACAKEJaCgIAACyAHDQALCyAAQf8BOgAADAQLI4GAgIAAIgVBx5bAgABqQccAIAVB1JDBgABqEPeBgIAAAAsgCCADIAMjgYCAgABB9JDBgABqEPiBgIAAAAsgBiAHIAcjgYCAgABB9JDBgABqEPiBgIAAAAsgACAFKQIANwIACyAEQRBqJICAgIAAC0QAAkAgACgCAEF/Rg0AIAEgACgCBCAAKAIIEIaCgIAADwsgASgCACABKAIEIAAoAgwoAgAiACgCACAAKAIEEPaBgIAACxsAIAAjgYCAgABBkJLBgABqNgIEIAAgATYCAAsMACAAIAEpAgA3AwALWwECfyABKAIEIQIgASgCACEDELmAgIAAAkBBCEEEELWAgIAAIgENAEEEQQgQ7IGAgAAACyABIAI2AgQgASADNgIAIAAjgYCAgABBkJLBgABqNgIEIAAgATYCAAsPACAAKAIAIAEQl4KAgAALFAAgASAAKAIAIAAoAgQQhoKAgAALkwEBAX8CQEECIAIgA0EQIANBEEkbEJaBgIAAIgNBf0cNACOBgICAACEDI46AgIAAKAIAIQIjj4CAgAAoAgAhBAJAIAIgA0GokMGAAGpGDQAjgYCAgABBqJDBgABqEJSCgIAACyAAQQA7AAEgACAENgIEIABBADoAACAAQQNqQQA6AAAPCyAAQf8BOgAAIAAgAzYCBAsEAEEBCwoAIABB/wE6AAALiwEBAX8CQEECIAIgAxCXgYCAACIDQX9HDQAjgYCAgAAhAyOOgICAACgCACECI4+AgIAAKAIAIQQCQCACIANBqJDBgABqRg0AI4GAgIAAQaiQwYAAahCUgoCAAAsgAEEAOwABIAAgBDYCBCAAQQA6AAAgAEEDakEAOgAADwsgAEH/AToAACAAIAM2AgQL+wIBBX8CQAJAIAMNAEEAIQQMAQsgA0EDcSEFQQAhBkEAIQQCQAJAIANBBEkNACACQRxqIQcgA0H8////AHEhCEEAIQRBACEGA0AgBygCACAHQXhqKAIAIAdBcGooAgAgB0FoaigCACAEampqaiEEIAdBIGohByAIIAZBBGoiBkcNAAsgBUUNAQsgBkEDdCACakEEaiEHA0AgBygCACAEaiEEIAdBCGohByAFQX9qIgUNAAsLIANBA3QhBwJAIAQgASgCACABKAIIIgVrTQ0AIAEgBSAEQQFBARDJgICAAAsgAiAHaiEDIAEoAgAhCCABKAIIIQUDQCACKAIAIQYCQAJAAkAgAkEEaigCACIHIAggBWtNDQAgASAFIAdBAUEBEMmAgIAAIAEoAgAhCCABKAIIIQUMAQsgB0UNAQsgB0UNACABKAIEIAVqIAYgB/wKAAALIAEgBSAHaiIFNgIIIAJBCGoiAiADRw0ACwsgAEH/AToAACAAIAQ2AgQLBABBAQvuAgEFfwJAIANFDQAgA0EDcSEEQQAhBUEAIQYCQAJAIANBBEkNACACQRxqIQcgA0H8////AHEhCEEAIQVBACEGA0AgBygCACAHQXhqKAIAIAdBcGooAgAgB0FoaigCACAGampqaiEGIAdBIGohByAIIAVBBGoiBUcNAAsgBEUNAQsgBUEDdCACakEEaiEHA0AgBygCACAGaiEGIAdBCGohByAEQX9qIgQNAAsLIANBA3QhBwJAIAYgASgCACIFIAEoAggiBGtNDQAgASAEIAZBAUEBEMmAgIAAIAEoAgAhBSABKAIIIQQLIAIgB2ohCANAIAIoAgAhBgJAAkACQCACQQRqKAIAIgcgBSAEa00NACABIAQgB0EBQQEQyYCAgAAgASgCACEFIAEoAgghBAwBCyAHRQ0BCyAHRQ0AIAEoAgQgBGogBiAH/AoAAAsgASAEIAdqIgQ2AgggAkEIaiICIAhHDQALCyAAQf8BOgAACwoAIABB/wE6AAALawEBfwJAAkACQCADIAEoAgAgASgCCCIEa00NACABIAQgA0EBQQEQyYCAgAAgASgCCCEEDAELIANFDQELIANFDQAgASgCBCAEaiACIAP8CgAACyAAIAM2AgQgAEH/AToAACABIAQgA2o2AggLZAEBfwJAAkACQCADIAEoAgAgASgCCCIEa00NACABIAQgA0EBQQEQyYCAgAAgASgCCCEEDAELIANFDQELIANFDQAgASgCBCAEaiACIAP8CgAACyAAQf8BOgAAIAEgBCADajYCCAueAgEGfyAAKAIIIQICQAJAIAFBgAFPDQBBASEDDAELAkAgAUGAEE8NAEECIQMMAQtBA0EEIAFBgIAESRshAwsCQCADIAAoAgAgAmtNDQAgACACIANBAUEBEMmAgIAACyAAKAIEIAJqIQQCQAJAIAFBgAFJDQAgAUE/cUGAf3IhBSABQQZ2IQYCQCABQYAQTw0AIAQgBToAASAEIAZBwAFyOgAADAILIAFBDHYhByAGQT9xQYB/ciEGAkAgAUH//wNLDQAgBCAFOgACIAQgBjoAASAEIAdB4AFyOgAADAILIAQgBToAAyAEIAY6AAIgBCAHQT9xQYB/cjoAASAEIAFBEnZBcHI6AAAMAQsgBCABOgAACyAAIAMgAmo2AghBAAteAQF/AkACQAJAIAIgACgCACAAKAIIIgNrTQ0AIAAgAyACQQFBARDJgICAACAAKAIIIQMMAQsgAkUNAQsgAkUNACAAKAIEIANqIAEgAvwKAAALIAAgAyACajYCCEEAC68BAgJ/AX4jgICAgABBIGsiAiSAgICAAAJAIAEoAgBBf0cNACABKAIMIQMgAkEANgIcIAJCgICAgBA3AhQgAkEUaiOBgICAAEHYj8GAAGogAygCACIDKAIAIAMoAgQQ9oGAgAAaIAIgAigCHCIDNgIQIAIgAikCFCIENwMIIAEgAzYCCCABIAQ3AgALIAAgATYCACAAI4GAgIAAQaCSwYAAajYCBCACQSBqJICAgIAAC5MCAgJ/AX4jgICAgABBIGsiAiSAgICAAAJAIAEoAgBBf0cNACABKAIMIQMgAkEANgIYIAJCgICAgBA3AhAgAkEQaiOBgICAAEHYj8GAAGogAygCACIDKAIAIAMoAgQQ9oGAgAAaIAIgAigCGCIDNgIIIAIgAikCECIENwMAIAEgAzYCCCABIAQ3AgALIAEoAgghAyABQQA2AgggASkCACEEIAFCgICAgBA3AgAgAiADNgIYIAIgBDcDEBC5gICAAAJAQQxBBBC1gICAACIBDQBBBEEMEOyBgIAAAAsgASACKAIYNgIIIAEgAikDEDcCACAAI4GAgIAAQaCSwYAAajYCBCAAIAE2AgAgAkEgaiSAgICAAAu5AQEBfyOAgICAAEEQayIEJICAgIAAIABB/wE6AAAgBCABNgIIIAQgACkCADcDACAEI4GAgIAAQYCPwYAAaiACIAMQ9oGAgAAhASAELQAAIQMCQAJAAkAgAUUNACADQf8BcUH/AUcNASOBgICAACIEQcmTwIAAakGtASAEQfCOwYAAahD3gYCAAAALIANB/wFxQQNHDQEgBEEEchCWgoCAAAwBCyAAIAQpAwA3AgALIARBEGokgICAgAALCQAgAEEANgIAC6EDBAV/AX4BfwF+I4CAgIAAQRBrIgIkgICAgAAgAkEANgIMAkACQCABQYABSQ0AIAFBP3FBgH9yIQMgAUEGdiEEAkAgAUGAEE8NACACIAM6AA0gAiAEQcABcjoADEECIQEMAgsgAUEMdiEFIARBP3FBgH9yIQQCQCABQf//A0sNACACIAM6AA4gAiAEOgANIAIgBUHgAXI6AAxBAyEBDAILIAIgAzoADyACIAQ6AA4gAiAFQT9xQYB/cjoADSACIAFBEnZBcHI6AAxBBCEBDAELIAIgAToADEEBIQELQQAhBgJAQQAgACgCCCIDKAIEIgUgAykDCCIHQv////8PIAdC/////w9UG6drIgQgBCAFSxsiBCABIAQgAUkbIghFDQAgAygCACAHIAWtIgkgByAJVBunaiACQQxqIAj8CgAACyADIAcgCK18NwMIAkAgBCABTw0AI4GAgIAAQeiRwYAAaikDACIHQv8Bg0L/AVENAAJAIAAtAABBA0cNACAAQQRqEJaCgIAACyAAIAc3AgBBASEGCyACQRBqJICAgIAAIAYLGwAgACOBgICAAEHYjsGAAGogASACEPaBgIAAC7kCAQR/I4CAgIAAQRBrIgIkgICAgAAgAkEANgIMAkACQCABQYABSQ0AIAFBP3FBgH9yIQMgAUEGdiEEAkAgAUGAEE8NACACIAM6AA0gAiAEQcABcjoADEECIQEMAgsgAUEMdiEFIARBP3FBgH9yIQQCQCABQf//A0sNACACIAM6AA4gAiAEOgANIAIgBUHgAXI6AAxBAyEBDAILIAIgAzoADyACIAQ6AA4gAiAFQT9xQYB/cjoADSACIAFBEnZBcHI6AAxBBCEBDAELIAIgAToADEEBIQELAkAgASAAKAIIIgAoAgAgACgCCCIDa00NACAAIAMgAUEBQQEQyYCAgAAgACgCCCEDCwJAIAFFDQAgACgCBCADaiACQQxqIAH8CgAACyAAIAMgAWo2AgggAkEQaiSAgICAAEEACxsAIAAjgYCAgABBgI/BgABqIAEgAhD2gYCAAAutAgEEfyOAgICAAEEQayICJICAgIAAIAJBADYCBAJAAkAgAUGAAUkNACABQT9xQYB/ciEDIAFBBnYhBAJAIAFBgBBPDQAgAiADOgAFIAIgBEHAAXI6AARBAiEBDAILIAFBDHYhBSAEQT9xQYB/ciEEAkAgAUH//wNLDQAgAiADOgAGIAIgBDoABSACIAVB4AFyOgAEQQMhAQwCCyACIAM6AAcgAiAEOgAGIAIgBUE/cUGAf3I6AAUgAiABQRJ2QXByOgAEQQQhAQwBCyACIAE6AARBASEBCyACQQhqIAIgAkEEaiABEOeAgIAAAkAgAi0ACCIBQf8BRg0AAkAgAC0AAEEDRw0AIABBBGoQloKAgAALIAAgAikDCDcCAAsgAkEQaiSAgICAACABQf8BRwsbACAAI4GAgIAAQZiPwYAAaiABIAIQ9oGAgAALxwEBAn8jgICAgABBoAhrIgIkgICAgAAgAkEUakEAQYAI/AsAAkAgACACQRRqQYAIENmBgIAAQX9MDQAgAkGUCGogAkEUaiACQRRqENqBgIAAEOuBgIAAIAJBCGogAkGUCGoQ8IGAgAAgASACKAIMIgMgAigCEBCGgoCAACEAAkAgAigCCCIBRQ0AIAMgAUEBELaAgIAACyACQaAIaiSAgICAACAADwsjgYCAgAAiAkHQmMCAAGpBJSACQfCRwYAAahD3gYCAAAALGwAgACOBgICAAEHYj8GAAGogASACEPaBgIAAC0YAAkACQAJAIAENACADRQ0CELmAgIAAIAMgAhC1gICAACICRQ0BDAILIAAgASACIAMQt4CAgAAiAg0BCxDlgICAAAALIAILAgALPAEBfyOAgICAAEEQayIBJICAgIAAIAEQgICAgAAgACABKQMINwMIIAAgASkDADcDACABQRBqJICAgIAACzIAAkAgAUUNACOBgICAACIBQYqawIAAakE5IAFBzJPBgABqEPeBgIAAAAsgAEEANgIACyMAAkAgAUUNACACIAMQ7IGAgAAACyAAIAM2AgQgACACNgIAC2MBAX8CQCACQQBIDQACQCACRQ0AA0ACQCABQQRqKAIAIgNFDQAgACABKAIAIAMQl4GAgAAPCyABQQhqIQEgAkF/aiICDQALCyAAQQBBABCXgYCAAA8LI4+AgIAAQRw2AgBBfwu4AQEEfyOAgICAAEEgayIDJICAgIAAQX8hBAJAIAAQnoGAgAAiAEUNAAJAIAAoAgQiBSgCCCIGRQ0AAkAgACgCACADQQhqIAYRhICAgACAgICAAEEATg0AQX8hBAwCCyADQQhqIAEgAhCfgYCAACEEDAELAkAgBSgCSCIGRQ0AIAAoAgAgASACQQBBAEEAIAYRhYCAgACAgICAACEEDAELI4+AgIAAQTo2AgALIANBIGokgICAgAAgBAsrAQF/I4CAgIAAQRBrIgEkgICAgAAgASAAQQBHOgAPIAFBD2oQrIGAgAAACyAA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AgAQ4IGAgAALIABBCGpCADcCACAAQRBqIQAgAUF/aiIBDQALIAIQ4IGAgAALCwoAIAAQgYCAgAALCgAgABCCgICAAAsEACAACxgAAkAgACgCBEUNACAAKAIAEOCBgIAACwsKACAAEIOAgIAACwQAIAALCgAgABCEgICAAAsEACAACwoAIAAQhYCAgAALCgAgABCGgICAAAs1AQF/I4CAgIAAQRBrIgEkgICAgAAgAUEIahCHgICAACAAIAEpAgg3AgAgAUEQaiSAgICAAAsOACAALQAAEIiAgIAAAAsKACAAEImAgIAACz8BAX8jgICAgABBEGsiAiSAgICAACAAKAIAIAAoAgQgAkEIahCKgICAACABIAIpAgg3AgAgAkEQaiSAgICAAAt3AgF/AX4jgICAgABBEGsiAySAgICAACAAIAMQi4CAgAACQAJAAkACQCADLQAADgIAAgELIAMpAwghBAsgASAENwMAQQEhAAwBCyACIAM1AgxCIIZCACADMQAIIgRQGyAEhDcCAEEAIQALIANBEGokgICAgAAgAAtcAQF/I4CAgIAAQRBrIgMkgICAgAAgACABKAIAIAEoAgQgA0EEahCMgICAAAJAIAMtAARBAUciAQ0AIAIgAy0ACDoAACACIAMoAgw2AgQLIANBEGokgICAgAAgAQtSAQF/I4CAgIAAQRBrIgIkgICAgAAgACACQQRqEI2AgIAAAkAgAi0ABEEBRyIADQAgASACLQAIOgAAIAEgAigCDDYCBAsgAkEQaiSAgICAACAACwoAIAAQjoCAgAALCAAQj4CAgAALCAAQkICAgAALCAAQkYCAgAALQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQkoCAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQk4CAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLQQEBfyOAgICAAEEQayIBJICAgIAAIAFBCGoQlICAgAAgACABKAIMNgIAIAEtAAghACABQRBqJICAgIAAIABBAUYLCgAgABCVgICAAAsIABDngYCAAAuyAgEDfyOAgICAAEEgayIAJICAgIAAAkACQAJAQQFBFBDigYCAACIBDQAjj4CAgABBMDYC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KAIEIAEgAkEBdCICIAEgAksbIgJBCCACQQhLGyICEOqBgIAAAkAgAygCBEEBRw0AIAMoAgggAygCDBDpgYCAAAALIAMoAgghASAAIAI2AgAgACABNgIEIANBEGokgICAgAALHAACQCAARQ0AIAAgARDsgYCAAAALEO6BgIAAAAuQAQACQAJAIANBAE4NAEEBIQFBBCECQQAhAwwBCwJAAkACQAJAIAFFDQAgAiABQQEgAxC3gICAACEBDAELAkAgAw0AQQEhAQwCCxC5gICAACADQQEQtYCAgAAhAQsgAQ0AQQEhASAAQQE2AgQMAQsgACABNgIEQQAhAQtBCCECCyAAIAJqIAM2AgAgACABNgIAC5wFAQR/I4CAgIAAQTBrIgMkgICAgAAgAyACNgIIIAMgATYCBCADQRRqIANBBGoQlYKAgAACQAJAAkACQCADKAIUIgRFDQAgAygCGCEBIAMoAiBFDQECQAJAIAINAEEBIQUMAQsQuYCAgAAgAkEBELWAgIAAIgVFDQMLQQAhBiADQQA2AiwgAyAFNgIoIAMgAjYCJAJAAkACQCABIAJNDQAgA0EkakEAIAEQ6IGAgAAgAygCJCECIAMoAighBSADKAIsIQYMAQsgAUUNAQsgAUUNACAFIAZqIAQgAfwKAAALIAMgBiABaiIBNgIsAkAgAiABa0ECSw0AIANBJGogAUEDEOiBgIAAIAMoAighBSADKAIsIQELIAUgAWoiAiOBgICAAEG678CAAGoiBC0AAjoAAiACIAQvAAA7AAAgAyABQQNqIgI2AiwgAyADKQIENwIMIANBFGogA0EMahCVgoCAAAJAIAMoAhQiBUUNAANAIAMoAiAhBAJAAkACQCADKAIYIgEgAygCJCACa00NACADQSRqIAIgARDogYCAACADKAIsIQIMAQsgAUUNAQsgAUUNACADKAIoIAJqIAUgAfwKAAALIAMgAiABaiICNgIsAkAgBEUNAAJAIAMoAiQgAmtBAksNACADQSRqIAJBAxDogYCAACADKAIsIQILIAMoAiggAmoiASOBgICAAEG678CAAGoiBC8AADsAACABIAQtAAI6AAIgAyACQQNqIgI2AiwLIANBFGogA0EMahCVgoCAACADKAIUIgUNAAsLIAAgAygCLDYCCCAAIAMpAiQ3AgAMAwtBACEBQQEhBAsgACAB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+4GAgABBAXML7AIBBX9BACEBI4GAgIAAQeCHwYAAaiICIAJBAEEbIABB/OUGSRsiAyADQQ1qIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQdqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQNqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQJqIgMgACACIANBAnRqKAIAQf///wBxSRsiAyADQQFqIgMgACACIANBAnRqKAIAQf///wBxSRsiA0ECdGooAgBBC3QiAiAAQQt0IgRGIAIgBElqIANqIgNBAnRqIgUoAgBBFXYhAkG1CyEEAkACQCADQTRLDQAgBSgCBEEVdiEEIANFDQELIAVBfGooAgBB////AHEhAQsCQCAEIAJBf3NqRQ0AIAAgAWshAyAEQX9qIQRBACEAA0AgACOBgICAAEHO8cCAAGogAmotAABqIgAgA0sNASAEIAJBAWoiAkcNAAsLIAJBAXELiQEBAn9BACEBAkACQAJAAkACQCAAQQh2IgJBamoOGwAEBAQEBAQEBAQDBAQEBAQEBAQEBAQEBAQEAQILIABBgC1GIQEMAwsgAEGA4ABGIQEMAgsgAg0BI5WAgIAAIABB/wFxai0AACEBDAELI5WAgIAAIABB/wFxai0AAEECcUEBdiEBCyABQQFxC+wCAQV/QQAhASOBgICAAEG4icGAAGoiAiACQQBBECAAQaudBEkbIgMgA0EIciIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EEciIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0ECciIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgMgA0EBaiIDIAAgAiADQQJ0aigCAEH///8AcUkbIgNBAnRqKAIAQQt0IgIgAEELdCIERiACIARJaiADaiIDQQJ0aiIFKAIAQRV2IQJB/wUhBAJAAkAgA0EfSw0AIAUoAgRBFXYhBCADRQ0BCyAFQXxqKAIAQf///wBxIQELAkAgBCACQX9zakUNACAAIAFrIQMgBEF/aiEEQQAhAANAIAAjgYCAgABBg/3AgABqIAJqLQAAaiIAIANLDQEgBCACQQFqIgJHDQALCyACQQFxC68CAQV/QQAhASOBgICAAEG8isGA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QQRqrYQ3AxgjgYCAgABBs4LAgABqIAVBGGogBBD3gYCAAAALyAEBBH8jgICAgABBEGsiAiSAgICAAEEBIQMCQCABKAIAIgRBJyABKAIEIgUoAhAiARGEgICAAICAgIAADQAgAiAAKAIAQYECEPmBgIAAAkACQCACLQANIgNBgQFJDQAgBCACKAIAIAERhICAgACAgICAAEUNAUEBIQMMAgsgBCACIAItAAwiAGogAyAAayAFKAIMEYOAgIAAgICAgABFDQBBASEDDAELIARBJyABEYSAgIAAgICAgAAhAwsgAkEQaiSAgICAACADC4YFAQN/I4CAgIAAQRBrIgIkgICAgAACQAJAAkACQCABKAIIIgNBgICAEHENACADQYCAgCBxDQEgACABEIeCgIAARQ0CQQEhBAwDCyAAKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEHQg8GAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0AC0EBIQQgAUEBI4GAgIAAQeaLwYAAakECIAJBCGogA2pBCGpBACADaxCCgoCAAEUNAQwCCyAAKAIAIQRBACEDA0AgAkEIaiADakEHaiOBgICAAEHoi8GAAGogBEEPcWotAAA6AAAgA0F/aiEDIARBBHYiBA0AC0EBIQQgAUEBI4GAgIAAQeaLwYAAakECIAJBCGogA2pBCGpBACADaxCCgoCAAA0BCyOBgICAACEDAkAgASgCACADQeSLwYAAakECIAEoAgQoAgwRg4CAgACAgICAAEUNAEEBIQQMAQsgAEEEaiEDAkACQCABKAIIIgRBgICAEHENACAEQYCAgCBxDQEgAyABEIeCgIAAIQQMAgsgAygCACEEQQAhAwNAIAJBCGogA2pBB2ojgYCAgABB0IPBgABqIARBD3FqLQAAOgAAIANBf2ohAyAEQQR2IgQNAAsgAUEBI4GAgIAAQeaLwYAAakECIAJBCGogA2pBCGpBACADaxCCgoCAACEEDAELIAMoAgAhBEEAIQMDQCACQQhqIANqQQdqI4GAgIAAQeiLwYAAaiAEQQ9xai0AADoAACADQX9qIQMgBEEEdiIEDQALIAFBASOBgICAAEHmi8GAAGpBAiACQQhqIANqQQhqQQAgA2sQgoKAgAAhBAsgAkEQaiSAgICAACAECxoAI4GAgIAAQeCDwYAA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cmlnaHQ6IMAAEGFzc2VydGlvbiBgbGVmdCDAECByaWdodGAgZmFpbGVkOiDACQogIGxlZnQ6IMAJCiByaWdodDogwAAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvc3lzL2lvL2Vycm9yL3VuaXgucnMAL3J1c3QvZGVwcy9oYXNoYnJvd24tMC4xNy4xL3NyYy9yYXcucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0L3NoYXJlZC9zbWFsbHNvcnQucnMAL2hvbWUvbGFiLy5ydXN0dXAvdG9vbGNoYWlucy9zdGFibGUteDg2XzY0LXVua25vd24tbGludXgtZ251L2xpYi9ydXN0bGliL3NyYy9ydXN0L2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC9zdGFibGUvcXVpY2tzb3J0LnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9tdXRleC9ub190aHJlYWRzLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvc3luYy9yd2xvY2svbm9fdGhyZWFkcy5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJzAC9ob21lL2xhYi8ucnVzdHVwL3Rvb2xjaGFpbnMvc3RhYmxlLXg4Nl82NC11bmtub3duLWxpbnV4LWdudS9saWIvcnVzdGxpYi9zcmMvcnVzdC9saWJyYXJ5L2NvcmUvc3JjL2lvL3dyaXRlLnJzAC9ydXN0Yy81OGNmOGY5YzM1YjM1NTE5OTcyNzYyN2QwN2FlMzRhNGUyODQ2ZDY3L2xpYnJhcnkvY29yZS9zcmMvaW8vd3JpdGUucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9jb3JlL3NyYy9pby9pb19zbGljZS5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL3N0ci9tb2QucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy9tb2QucnMAL3J1c3RjLzU4Y2Y4ZjljMzViMzU1MTk5NzI3NjI3ZDA3YWUzNGE0ZTI4NDZkNjcvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9pZC5ycwAvcnVzdGMvNThjZjhmOWMzNWIzNTUxOTk3Mjc2MjdkMDdhZTM0YTRlMjg0NmQ2Ny9saWJyYXJ5L2NvcmUvc3JjL2lvL2lvX3NsaWNlL3JlcHJfaW92ZWMucnMAcGFja2FnZXMvd2FzbS9zY2VuZTNkL3NyYy9saWIucnMALwARc3RhcnQgYnl0ZSBpbmRleCDAJiBpcyBub3QgYSBjaGFyIGJvdW5kYXJ5OyBpdCBpcyBpbnNpZGUgwAggKGJ5dGVzIMALIG9mIHN0cmluZykAD2VuZCBieXRlIGluZGV4IMAmIGlzIG5vdCBhIGNoYXIgYm91bmRhcnk7IGl0IGlzIGluc2lkZSDACCAoYnl0ZXMgwAsgb2Ygc3RyaW5nKQAVbWVtb3J5IGFsbG9jYXRpb24gb2YgwEcgYnl0ZXMgZmFpbGVkCnNraXBwaW5nIGJhY2t0cmFjZSBwcmludGluZyB0byBhdm9pZCBwb3RlbnRpYWwgcmVjdXJzaW9uCgA1ZmF0YWwgcnVudGltZSBlcnJvcjogZmFpbGVkIHRvIGluaXRpYXRlIHBhbmljLCBlcnJvciDACywgYWJvcnRpbmcKABVtZW1vcnkgYWxsb2NhdGlvbiBvZiDADiBieXRlcyBmYWlsZWQKAAxwYW5pY2tlZCBhdCDAAjoKwDMKdGhyZWFkIHBhbmlja2VkIHdoaWxlIHByb2Nlc3NpbmcgcGFuaWMuIGFib3J0aW5nLgoACQp0aHJlYWQgJ8ADJyAowA4pIHBhbmlja2VkIGF0IMACOgrAAQoAGWFib3J0aW5nIGR1ZSB0byBwYW5pYyBhdCDAAjoKwAEKACM5YmIwZmYjYWFiZmZmI2M5ZDZmZiNmOGY5ZmYjZmZmMmRmI2ZmZDlhMCNmZmI0NmMjZmY5YTU1cGxhbmV0IzdmYjhkZCNhOGM2ZTAjZDljNDlhI2M5OGE1YSNiMDZhNGYjOGQ5ZGI2I2UwZDNiOCNjMTU3M2IAAAAAAAAAbWlkID4gbGVuZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcmEgZm9ybWF0dGluZyB0cmFpdCBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB3aGVuIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBkaWQgbm90ZmlsZSBuYW1lIGNvbnRhaW5lZCBhbiB1bmV4cGVjdGVkIE5VTCBieXRlbWFpbjx1bm5hbWVkPm5vdGU6IHJ1biB3aXRoIGBSVVNUX0JBQ0tUUkFDRT0xYCBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBkaXNwbGF5IGEgYmFja3RyYWNlClz26V/cAva58cFwbPJhwSQPJ2bxohUEikyn8/12At9xZmF0YWwgcnVudGltZSBlcnJvcjogcndsb2NrIGxvY2tlZCBmb3Igd3JpdGluZywgYWJvcnRpbmcKcndsb2NrIG92ZXJmbG93ZWQgcmVhZCBsb2Nrc1JVU1RfQkFDS1RSQUNFY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXhhZHZhbmNpbmcgSW9TbGljZSBiZXlvbmQgaXRzIGxlbmd0aGFkdmFuY2luZyBpbyBzbGljZXMgYmV5b25kIHRoZWlyIGxlbmd0aABCb3g8ZHluIEFueT50aHJlYWQgY2F1c2VkIG5vbi11bndpbmRpbmcgcGFuaWMuIGFib3J0aW5nLgpzdGFjayBiYWNrdHJhY2U6Cm5vdGU6IFNvbWUgZGV0YWlscyBhcmUgb21pdHRlZCwgcnVuIHdpdGggYFJVU1RfQkFDS1RSQUNFPWZ1bGxgIGZvciBhIHZlcmJvc2UgYmFja3RyYWNlLgpmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyc3RyZXJyb3JfciBmYWlsdXJlZmFpbGVkIHRvIGdlbmVyYXRlIHVuaXF1ZSB0aHJlYWQgSUQ6IGJpdHNwYWNlIGV4aGF1c3Rl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ZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UATm90IGEgc29ja2V0AERlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQATWVzc2FnZSB0b28gbGFyZ2UAUHJvdG9jb2wgd3JvbmcgdHlwZSBmb3Igc29ja2V0AFByb3RvY29sIG5vdCBhdmFpbGFibGUAUHJvdG9jb2wgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAE9wZXJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzAE9wZXJhdGlvbiBpbiBwcm9ncmVz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BAECAQ8BxQIQKUwECgQCAERMPcIEARsBAgEBAgEBCgEEAQEBAQYBBAEBAQEBAQMBAgEBAgEBAQEBAQEBAQECAQECBAEHAQQBBAEBAQoBEQUDAQUBETQCACwEZAwPAg8BDwElCq44HQ0sBAkHAg4GmgADEQMNA9oGDAQBDwwEOAgKBigIHgIMBAIOCScACA4CDQMLAzkBAQQQAgwECgeTAWcAACAAAgACAA8AAAAAAAUAAAAAcAAHAC0BAQECAQIBAUgLMBUQAWUHAgYCAgEEIwEeG1sLOgkJARgEAQkBAwEFKwM7CSoYASA3AQEBBAgEAQMHCgIdAToBAQECBAgBCQEKAhoBAgI5AQQCBAICAwMBHgIDAQsCOQEEBQECBAEUAhYGAQE6AQECAQQIAQcDCgIeATsBAQEMAQkBKAEDATcBAQMFAwEEBwILAh0BOgECAgEBAwMBBAcCCwIcAjkCAQECBAgBCQEKAh0BSAEEAQIDAQEIAVEBAgcMCGIBAgkLB0kCGwEBAQEBNw4BBQECBQsBJAkBZgQBBgECAgIZAgQDEAQNAQICBgEPAQADAAQcAx0CHgJAAgEHCAECCwkBLQMBAXUCIgF2AwQCCQEGA9sCAgE6AQEHAQEBAQIIBgoCATAuAgwUBDAKBAMmCQwCIAQCBjgBAQIDAQEFOAgCApgDAQ0BBwQBBgEDAsZAAAHDIQADjQFgIAAGaQIABAEKIAJQAgABAwEEARkCBQGXAhoSDQEmCBkLAQEsAzABAgQCAgIBJAFDBgICAgIMAQgBLwEzAQEDAgIFAgEBKgIIAe4BAgEEAQABABAQEAACAAHiAZUFAAMBAgUEKAMEAaUCAARBBQACTQZGCzEEewE2DykBAgIKAzEEAgIHAT0DJAUBCD4BDAI0CQEBCAQCAV8DAgQGAQIBnQEDCBUCOQIBAQEBDAEJAQ4HAwVDAQIGAQECAQEDBAMBAQ4CVQgCAwEBFwFRAQIGAQECAQECAQLrAQIEBgIBAhsCVQgCAQECagEBAQIIZQEBAQIEAQUACQEC9QEKBAQBkAQCAgQBIAooBgIECAEJBgIDLg0BAsYBAQMBAckHAQYBAVIWAgcBAgECegYDAQECAQcBAUgCAwEBAQACCwI0BQUDFwEAAQYPAAwDAwAFOwcAAT8EUQELAgACAC4CFwAFAwYICAIHHgSUAwA3BDII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");
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
