export type Result<T> =
	| {
			readonly value: T;
			hasError(): this is { readonly error: Error };
	  }
	| {
			readonly error: Error;
			hasError(): this is { readonly error: Error };
	  };

export function createResult<T>(value: T): Result<T> {
	return {
		value,
		hasError(): this is { readonly error: Error } {
			return false;
		},
	};
}

export function createErrorResult<T = unknown>(error: Error | unknown): Result<T> {
	const hasError = (): this is { readonly error: Error } => {
		return true;
	};
	if (error instanceof Error) {
		return {
			error,
			hasError,
		};
	}
	return {
		error: new Error(typeof error === 'string' ? error : JSON.stringify(error)),
		hasError,
	};
}
