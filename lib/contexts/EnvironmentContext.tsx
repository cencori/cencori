"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Environment = "production" | "test";

interface EnvironmentContextType {
    environment: Environment;
    setEnvironment: (env: Environment) => void;
    isTestMode: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
    const [environment, setEnvironment] = useState<Environment>("production");

    // Persist environment preference
    useEffect(() => {
        const storedEnv = localStorage.getItem("cencori-environment") as Environment;
        if (storedEnv && (storedEnv === "production" || storedEnv === "test")) {
            setEnvironment(storedEnv);
        }
    }, []);

    const handleSetEnvironment = (env: Environment) => {
        setEnvironment(env);
        localStorage.setItem("cencori-environment", env);
    };

    return (
        <EnvironmentContext.Provider
            value={{
                environment,
                setEnvironment: handleSetEnvironment,
                isTestMode: environment === "test",
            }}
        >
            {children}
        </EnvironmentContext.Provider>
    );
}

export function useEnvironment() {
    const context = useContext(EnvironmentContext);
    if (context === undefined) {
        throw new Error("useEnvironment must be used within an EnvironmentProvider");
    }
    return context;
}
