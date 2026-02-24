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
            </AnimationRoutes>
          </ZMPRouter>
        </SnackbarProvider>
      </App>
    </JotaiProvider>
  );
};
export default Layout;
