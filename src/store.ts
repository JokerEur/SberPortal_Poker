// type Note = {
//   id: string;
//   title: string;
//   completed: boolean;
// };

// type State = {
//   notes: Array<Note>;
// };

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
    