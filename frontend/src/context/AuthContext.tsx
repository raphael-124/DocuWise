export const AuthContext = null;
export const AuthProvider = ({ children }: any) => children;
export const useAuth = () => ({ token: null, user: null, login: () => {}, logout: () => {}, register: () => {} });
