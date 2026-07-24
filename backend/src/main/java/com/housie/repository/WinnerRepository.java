package com.housie.repository;

import com.housie.model.Winner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WinnerRepository extends JpaRepository<Winner, Long> {
    List<Winner> findByRoomCode(String roomCode);
    Optional<Winner> findByRoomCodeAndCategory(String roomCode, String category);
}
