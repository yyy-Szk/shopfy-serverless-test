import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Routes from "./Routes";

import {
  AppBridgeProvider,
  QueryProvider,
  PolarisProvider,
} from "./components";
import { NavigationMenu } from "@shopify/app-bridge-react";

export default function App() {
  // Any .tsx or .jsx files in /pages will become a route
  // See documentation for <Routes /> for more info
  const pages = import.meta.globEager("./pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  const { t } = useTranslation();

  return (
    <PolarisProvider>
      <BrowserRouter>
        <AppBridgeProvider>
          <NavigationMenu
          navigationLinks={[
            {
              label: 'Home',
              destination: '/',
            },
            {
              label: 'New Account',
              destination: '/accounts/new',
            },
          ]}
          matcher={(link, location) => link.destination === location.pathname}
        />
          <QueryProvider>
            <Routes pages={pages} />
          </QueryProvider>
        </AppBridgeProvider>
      </BrowserRouter>
    </PolarisProvider>
  );
}
