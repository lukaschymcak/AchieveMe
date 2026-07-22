export interface ToastQueueState<T> {
  queue: T[]
  busy: boolean
}

export function createToastQueueState<T>(): ToastQueueState<T> {
  return { queue: [], busy: false }
}

export function enqueueToast<T>(state: ToastQueueState<T>, item: T): ToastQueueState<T> {
  return { queue: [...state.queue, item], busy: state.busy }
}

/** Start the next toast if idle and the queue is non-empty. */
export function takeNextToast<T>(
  state: ToastQueueState<T>
): { state: ToastQueueState<T>; item: T | null } {
  if (state.busy || state.queue.length === 0) {
    return { state, item: null }
  }

  const [item, ...rest] = state.queue
  return {
    state: { queue: rest, busy: true },
    item
  }
}

export function markToastIdle<T>(state: ToastQueueState<T>): ToastQueueState<T> {
  return { queue: state.queue, busy: false }
}
