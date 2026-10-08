import { Button } from "./Button";

type DeleteButtonProps = {
  onClick: () => void;
};

export const DeleteButton = ({ onClick }: DeleteButtonProps) => (
  <Button variant="danger" onClick={onClick}>
    삭제
  </Button>
);
