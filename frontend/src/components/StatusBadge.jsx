import { getBedStatus } from "../utils/hospital";


const badgeClasses = {
  green: "border-green-200 bg-green-50 text-green-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
};


export default function StatusBadge({ bedsAvailable }) {
  const status = getBedStatus(bedsAvailable);

  return <span className={["chip", badgeClasses[status.tone]].join(" ")}>{status.label}</span>;
}
