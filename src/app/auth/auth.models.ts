export interface AuthUser {
  id: number;
  email: string;
  role: string;
  sellerId: number | null;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}
