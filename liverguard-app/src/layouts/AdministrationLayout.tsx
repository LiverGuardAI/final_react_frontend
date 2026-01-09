import { Outlet } from "react-router-dom";
import { AdministrationProvider } from "../contexts/AdministrationContext";

const AdministrationLayout = () => {
    return (
        <AdministrationProvider>
            <Outlet />
        </AdministrationProvider>
    );
};

export default AdministrationLayout;
