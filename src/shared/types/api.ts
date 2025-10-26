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
  name?: string;
  role: UserRole;
}

export enum UserRole {
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  USER = "USER",
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
