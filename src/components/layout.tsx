import { getSystemInfo } from "zmp-sdk";
import {
  AnimationRoutes,
  App,
  Route,
  SnackbarProvider,
  ZMPRouter,
} from "zmp-ui";
import { AppProps } from "zmp-ui/app";
import { Provider as JotaiProvider } from "jotai";

import DealerLookupPage from "@/pages/dealer-lookup";
import EarnPointsPage from "@/pages/earn-points";
import ResultPage from "@/pages/result";
import LoginPage from "@/pages/login";
import CustomerHistoryPage from "@/pages/customer-history";
import DealerDashboardPage from "@/pages/dealer-dashboard";
import StaffHomePage from "@/pages/staff-home";
import AdminHomePage from "@/pages/admin-home";
import BarcodeManagePage from "@/pages/barcode-manage";

const Layout = () => {
  return (
    <JotaiProvider>
      <App theme={getSystemInfo().zaloTheme as AppProps["theme"]}>
        <SnackbarProvider>
          <ZMPRouter>
            <AnimationRoutes>
              <Route path="/" element={<DealerLookupPage />} />
              <Route path="/earn-points" element={<EarnPointsPage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/customer-history" element={<CustomerHistoryPage />} />
              <Route path="/dealer-dashboard" element={<DealerDashboardPage />} />
              <Route path="/staff-home" element={<StaffHomePage />} />
              <Route path="/admin-home" element={<AdminHomePage />} />
              <Route path="/barcode-manage" element={<BarcodeManagePage />} />
            </AnimationRoutes>
          </ZMPRouter>
        </SnackbarProvider>
      </App>
    </JotaiProvider>
  );
};
export default Layout;
