export declare namespace Request {
  export interface AddRecipients {
    [id: number]: {
      email: string
      first_name?: string
      last_name?: string
    }
  }
}

export declare namespace Response {
  export interface AddRecipients {
    error_count: number
    error_indices?: number[]
    new_count: number
    updated_count: number
    persisted_recipients: string[]
    errors?: {
      message: string
      error_indices: number[]
    }[]
  }
}
