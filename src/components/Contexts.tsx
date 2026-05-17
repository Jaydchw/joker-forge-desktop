import React, { createContext, useState } from "react";
import type { UserConfig } from "@/lib/balatro/balatro-utils";

const defaultConfig: UserConfig = {
  pageData: [],
  defaultAutoFormat: true,
  defaultGridSnap: false,
};

export interface UserConfigContextValue {
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
}

export const UserConfigContext = createContext<UserConfigContextValue>({
  userConfig: defaultConfig,
  setUserConfig: () => {},
});

export const UserConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userConfig, setUserConfig] = useState<UserConfig>(defaultConfig);

  return (
    <UserConfigContext.Provider value={{ userConfig, setUserConfig }}>
      {children}
    </UserConfigContext.Provider>
  );
};
