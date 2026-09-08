export const TEAM_IDS = ["soldiers", "terrorists"];
export const TEAMS = {
  soldiers: {
    name: "SOLDIERS",
    color: "#67c7da",
    model: "soldier",
    primary: "m4a4",
    secondary: "usps",
  },
  terrorists: {
    name: "TERRORISTS",
    color: "#eda46d",
    model: "terrorist",
    primary: "ak47",
    secondary: "glock18",
  },
};
export const emptyScores = () => ({ soldiers: 0, terrorists: 0 });
