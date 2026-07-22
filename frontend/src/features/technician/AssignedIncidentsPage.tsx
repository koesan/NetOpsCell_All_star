import { IncidentsListPage } from "../shared/IncidentsListPage";

export function AssignedIncidentsPage() {
  return (
    <IncidentsListPage
      title="Vakalarım"
      description="Size atanan arızalar — rota planınız ve canlı ilerlemeniz haritada."
      basePath="/saha/vakalarim"
      showMap
      showTeamsOnMap={false}
    />
  );
}
