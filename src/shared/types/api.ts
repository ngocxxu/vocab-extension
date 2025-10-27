export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInResponse {
  session: SessionDto;
  accessToken: string;
  refreshToken: string;
}

export interface SessionDto {
  user: UserDto;
}

export interface UserDto {
  id: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  supabaseUserId: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginationDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
