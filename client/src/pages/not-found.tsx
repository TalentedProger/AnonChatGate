import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Страница не найдена</h1>
            <p className="text-muted-foreground">
              Запрашиваемая страница не существует
            </p>
          </div>

          <Link href="/">
            <Button className="w-full" data-testid="button-go-home">
              <Home className="mr-2 h-4 w-4" />
              На главную
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
