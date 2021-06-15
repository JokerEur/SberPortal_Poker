type Action =
  | {
    type: "add_note";
  }
  | {
    type: "done_note";
  }
  | {
    type: "delete_note";
  };
