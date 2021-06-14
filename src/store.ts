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

export const reducer = (action: Action) => {
  switch (action.type) {
    case "add_note":
      return {
        
      };

    case "done_note":
      return {
      };

    case "delete_note":
      return {
      };

    default:
      throw new Error();
  }
};
