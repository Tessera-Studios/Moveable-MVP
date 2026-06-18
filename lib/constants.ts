export const APP_NAME: string = "Move Able";

export const APP_DESCRIPTION: string = "Physical therapy, tracked and connected.";

export const MAX_CONTAINER_WIDTH: number = 512;

export const ROUTES: {
  login: string;
  register: string;
  providerDashboard: string;
  patientDashboard: string;
  providerPatients: string;
  providerTemplates: string;
  providerLibrary: string;
  providerSessionNew: string;
} = {
  login: "/login",
  register: "/register",
  providerDashboard: "/provider",
  patientDashboard: "/patient",
  providerPatients: "/provider/patients",
  providerTemplates: "/provider/templates",
  providerLibrary: "/provider/library",
  providerSessionNew: "/provider/sessions/new",
};
