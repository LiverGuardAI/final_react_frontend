import { memo } from "react";
import styles from "./LisTopBar.module.css";

export type LisTabType = "blood" | "tissue";

interface LisTopBarProps {
  activeTab: LisTabType;
  onTabChange: (tab: LisTabType) => void;
}

const LisTopBar = memo(function LisTopBar({ activeTab, onTabChange }: LisTopBarProps) {
  return (
    <div className={styles.topBar}>
      <button
        type="button"
        className={`${styles.tabButton} ${activeTab === "blood" ? styles.tabButtonActive : ""}`}
        onClick={() => onTabChange("blood")}
      >
        혈액검사
      </button>
      <button
        type="button"
        className={`${styles.tabButton} ${activeTab === "tissue" ? styles.tabButtonActive : ""}`}
        onClick={() => onTabChange("tissue")}
      >
        조직검사
      </button>
    </div>
  );
});

export default LisTopBar;
