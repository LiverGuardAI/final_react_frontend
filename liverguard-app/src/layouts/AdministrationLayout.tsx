import { Outlet } from "react-router-dom";
import { AdministrationProvider } from "../contexts/AdministrationContext";
import AdministrationSidebar from "../components/administration/AdministrationSidebar";
import AdministrationTopBar from "../components/administration/AdministrationTopBar";
import styles from "../pages/administration/Dashboard.module.css";

const AdministrationLayout = () => {
    return (
        <AdministrationProvider>
            <div className={styles.container}>
                <AdministrationSidebar />
                <div className={styles.mainArea}>
                    <AdministrationTopBar />
                    <div className={styles.mainContent}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </AdministrationProvider>
    );
};

export default AdministrationLayout;
