import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";

export default function ErrorPage() {
    const error = useRouteError();
    const navigate = useNavigate();

    let errorMessage: string;

    if (isRouteErrorResponse(error)) {
        // error is type `ErrorResponse`
        errorMessage = error.statusText || error.data?.message || "Unknown error";
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        console.error(error);
        errorMessage = 'Unknown error';
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f8fafc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                textAlign: 'center',
                maxWidth: '500px',
                width: '90%'
            }}>
                <h1 style={{
                    fontSize: '72px',
                    fontWeight: '900',
                    margin: '0 0 20px 0',
                    color: '#ef4444'
                }}>
                    {isRouteErrorResponse(error) ? error.status : 'Oops!'}
                </h1>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    marginBottom: '10px',
                    color: '#1e293b'
                }}>
                    문제가 발생했습니다.
                </h2>
                <p style={{
                    color: '#64748b',
                    marginBottom: '30px',
                    lineHeight: '1.5'
                }}>
                    {isRouteErrorResponse(error) && error.status === 404
                        ? "요청하신 페이지를 찾을 수 없습니다. URL을 확인해주세요."
                        : `오류 내용: ${errorMessage}`}
                </p>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                    이전 페이지로 돌아가기
                </button>
            </div>
        </div>
    );
}
