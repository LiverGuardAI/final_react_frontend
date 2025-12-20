import { useState } from "react";

interface LoginFormProps {
    role: string;
    onSubmit: (username: string, password: string) => void;
}

export default function LoginForm({ role, onSubmit }: LoginFormProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const submitHandler = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(username, password);
    };

    return (
        <form onSubmit={submitHandler}>
            <h2>{role} 로그인</h2>

            <input
                type="text"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />

            <input 
                type="password"
                placeholder="비밀번호"
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit">로그인</button>
        </form>
    );
}