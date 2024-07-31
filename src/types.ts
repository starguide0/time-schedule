export const AsyncFunction = (async () => {}).constructor;

export const isPromise = <T>(a: Promise<T> | T): a is Promise<T> => {
  if (a instanceof Promise) {
    return true;
  }

  if (a instanceof AsyncFunction) {
    return true;
  }

  return a !== null
    && typeof a === 'object'
    && typeof (a as any).then === 'function'
    && typeof (a as any).catch === 'function';
};

export const isAsyncFunction = (func: unknown) => func instanceof AsyncFunction;
